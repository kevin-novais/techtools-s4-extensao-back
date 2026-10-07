variable "project_id" {
  type        = string
  description = "The ID of the project in which to provision resources."
}

variable "project_number" {
  type        = string
  description = "The number of the project in which to provision resources."
}

variable "region" {
  type        = string
  description = "The region in wich to provision resources."
}

variable "env" {
  type        = string
  description = "Short version of the environment in which Terraform is running."
}

variable "environment" {
  type        = string
  description = "The environment in which Terraform is running."
}

variable "team" {
  type        = string
  description = "The team responsible for the services being deployed."
}

variable "prefix" {
  type        = string
  description = "A prefix to be added to all resource names. Usually the Git repository name."
}


variable "image_tag" {
  type        = string
  description = "The container image tag to be used by Cloud Run."
}

variable "namespace" {
  type        = string
  description = "The subnetwork that will be used by Cloud Run instances."
}

variable "helm_values_path" {
  type        = string
  description = "The subnetwork that will be used by Cloud Run instances."
}

variable "gke_cluster_name" {
  type        = string
  description = "The GKE cluster name."
}

variable "gke_cluster_region" {
  type        = string
  description = "The GKE cluster region."
}

variable "envs_path" {
  type        = string
  description = "The path of environment variables."
}
