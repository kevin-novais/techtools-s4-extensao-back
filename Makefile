SHELL := /bin/bash

REPOSITORY_NAME ?= $(shell basename "$(PWD)")
GITHUB_SHA ?= $(shell git rev-parse --short=12 HEAD)
GCP_REGION ?= us-east4
PROJECT_ID ?= $(shell gcloud config get-value project 2>/dev/null)
USE_CLOUD_BUILD ?= true

GITHUB_REF_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
ifeq ($(GITHUB_REF_NAME),main)
	TF_ENV_FOLDER := main
else ifeq ($(GITHUB_REF_NAME),staging)
	TF_ENV_FOLDER := staging
else
	TF_ENV_FOLDER :=
endif

IMAGE_URI := $(GCP_REGION)-docker.pkg.dev/$(PROJECT_ID)/$(PROJECT_ID)/$(REPOSITORY_NAME):$(GITHUB_SHA)
CACHE_URI := $(GCP_REGION)-docker.pkg.dev/$(PROJECT_ID)/$(PROJECT_ID)/$(REPOSITORY_NAME):$(GITHUB_REF_NAME)-cache
BACKEND_CONFIG := kubernetes/tfenvs/$(TF_ENV_FOLDER)/k8s-config.gcs.tfbackend
VAR_FILE := kubernetes/tfenvs/$(TF_ENV_FOLDER)/k8s-terraform.tfvars

.PHONY: help install ci prisma-generate build start test test-unit test-integration docker-auth docker-build-local docker-build-cloud docker-build docker-push push deploy plan migrate clean validate-branch

help:
	@printf "Targets:\n"
	@printf "  install           Install dependencies (npm ci)\n"
	@printf "  ci                Install deps + generate Prisma clients + build\n"
	@printf "  prisma-generate   Generate all Prisma clients\n"
	@printf "  build             Compile TypeScript\n"
	@printf "  start             Run built application\n"
	@printf "  test              Run unit tests\n"
	@printf "  test-integration  Run integration tests\n"
	@printf "  docker-build      Build image (cloud/local)\n"
	@printf "  docker-build-local Build image with local Docker cache\n"
	@printf "  docker-build-cloud Build image using Google Cloud Build\n"
	@printf "  docker-push       Push app image and cache tag\n"
	@printf "  push              Alias for docker-push\n"
	@printf "  plan              Run OpenTofu plan\n"
	@printf "  deploy            Run OpenTofu apply\n"

install:
	npm ci

ci: install prisma-generate build

prisma-generate:
	npm run prisma:generate

build:
	npm run build

start:
	npm run start

test:
	npm run test:unit

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

docker-auth:
	gcloud auth configure-docker "$(GCP_REGION)-docker.pkg.dev" --quiet

docker-build-local:
	@if [ -z "$(PROJECT_ID)" ]; then echo "PROJECT_ID is required"; exit 1; fi
	docker pull "$(CACHE_URI)" || true
	docker build --cache-from "$(CACHE_URI)" -t "$(IMAGE_URI)" -t "$(CACHE_URI)" .

docker-build-cloud:
	@if [ -z "$(PROJECT_ID)" ]; then echo "PROJECT_ID is required"; exit 1; fi
	gcloud builds submit --project "$(PROJECT_ID)" --region "$(GCP_REGION)" --tag "$(IMAGE_URI)" --timeout=1800s .

docker-build:
	@if [ "$(USE_CLOUD_BUILD)" = "true" ]; then \
		$(MAKE) docker-build-cloud; \
	else \
		$(MAKE) docker-build-local; \
	fi

docker-push: docker-auth docker-build
	@if [ "$(USE_CLOUD_BUILD)" = "true" ]; then \
		echo "Image already pushed by Cloud Build: $(IMAGE_URI)"; \
	else \
		docker push "$(IMAGE_URI)"; \
		docker push "$(CACHE_URI)"; \
	fi

push: docker-push

validate-branch:
	@if [ -z "$(TF_ENV_FOLDER)" ]; then echo "Unsupported branch: $(GITHUB_REF_NAME). Use main or staging."; exit 1; fi

plan: validate-branch
	@cd kubernetes && tofu init -backend-config="tfenvs/$(TF_ENV_FOLDER)/k8s-config.gcs.tfbackend" -reconfigure
	@cd kubernetes && tofu plan -input=false -var-file="tfenvs/$(TF_ENV_FOLDER)/k8s-terraform.tfvars" -var="prefix=$(REPOSITORY_NAME)" -var="image_tag=$(GITHUB_SHA)"

deploy: validate-branch
	@cd kubernetes && tofu init -backend-config="tfenvs/$(TF_ENV_FOLDER)/k8s-config.gcs.tfbackend" -reconfigure
	@cd kubernetes && tofu apply -input=false -var-file="tfenvs/$(TF_ENV_FOLDER)/k8s-terraform.tfvars" -var="prefix=$(REPOSITORY_NAME)" -var="image_tag=$(GITHUB_SHA)" -auto-approve

migrate:
	npm run prisma:migrate:deploy:s4

clean:
	rm -rf dist coverage .terraform .terraform.lock.hcl
