provider "google" {
  project = var.project_id
}

terraform {
  backend "gcs" {
  }

  required_version = ">= 1.7.2"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.17.0"
    }
  }
}
