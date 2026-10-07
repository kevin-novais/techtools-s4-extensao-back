locals {
  service_account = "${var.prefix}@${var.project_id}.iam.gserviceaccount.com"
  visual_cron_service_account = "techtools-s4-ext-visualcron@${var.project_id}.iam.gserviceaccount.com"
  container_image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.project_id}/${var.prefix}:${var.image_tag}"

  labels = {
    service     = var.prefix
    environment = var.env
    team        = var.team
    terraform   = "true"
  }
}

resource "kubernetes_namespace_v1" "services_namespace" {
  metadata {
    name = var.prefix
  }
}

#region [Service Accounts]

resource "google_service_account_key" "mykey" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${local.service_account}"
}

#endregion

#region [Buckets]

resource "google_storage_bucket" "bucket_s4_extensao" {
  name                        = "${var.env}-${var.prefix}"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  labels                      = local.labels
}

resource "google_storage_bucket_iam_binding" "bucket_s4_extensao_creator" {
  bucket = google_storage_bucket.bucket_s4_extensao.name
  role   = "roles/storage.objectCreator"
  members = [
    "serviceAccount:${local.service_account}",
    "serviceAccount:${local.visual_cron_service_account}",
  ]
}

resource "google_storage_bucket_iam_binding" "bucket_s4_extensao_viewer" {
  bucket = google_storage_bucket.bucket_s4_extensao.name
  role   = "roles/storage.objectViewer"
  members = [
    "serviceAccount:${local.service_account}",
    "serviceAccount:${local.visual_cron_service_account}",
  ]
}

resource "google_storage_bucket_iam_binding" "bucket_s4_extensao_deleter" {
  bucket = google_storage_bucket.bucket_s4_extensao.name
  role   = "roles/storage.objectUser"
  members = [
    "serviceAccount:${local.visual_cron_service_account}",
  ]
}

#endregion

#region [Kubernetes Configs]

resource "kubernetes_secret" "google-application-credentials" {
  metadata {
    name      = "${var.prefix}-service-account"
    namespace = var.prefix
  }
  data = {
    "credentials.json" = base64decode(google_service_account_key.mykey.private_key)
  }

  depends_on = [google_service_account_key.mykey, kubernetes_namespace_v1.services_namespace]
}

data "google_container_cluster" "gke_cluster" {
  project  = var.project_id
  name     = var.gke_cluster_name
  location = var.gke_cluster_region
}

data "google_client_config" "provider" {}

provider "kubernetes" {
  host  = "https://${data.google_container_cluster.gke_cluster.endpoint}"
  token = data.google_client_config.provider.access_token
  cluster_ca_certificate = base64decode(
    data.google_container_cluster.gke_cluster.master_auth[0].cluster_ca_certificate,
  )
}

provider "helm" {
  kubernetes {
    host                   = "https://${data.google_container_cluster.gke_cluster.endpoint}"
    token                  = data.google_client_config.provider.access_token
    cluster_ca_certificate = base64decode(data.google_container_cluster.gke_cluster.master_auth[0].cluster_ca_certificate)
  }
}

#endregion

#region [secret manager]

data "google_secret_manager_secret_version" "github_token" {
  project = var.project_id

  secret  = "github_token"
  version = "latest"
}

data "google_secret_manager_secret_version" "elastic_token" {
  project = var.project_id
  secret  = "elastic_apm_token"
  version = "latest"
}

data "google_secret_manager_secret_version" "database_url" {
  project = var.project_id
  secret  = "techtools_s4_extensao_back_database_url"
  version = "latest"
}

data "google_secret_manager_secret_version" "dotz_stage_database_url" {
  project = var.project_id
  secret  = "techtools_s4_extensao_back_dotz_stage_database_url"
  version = "latest"
}

data "google_secret_manager_secret_version" "app_api_key" {
  project = var.project_id
  secret  = "techtools_s4_extensao_app_api_key"
  version = "latest"
}

data "google_secret_manager_secret_version" "access_token_secret" {
  project = var.project_id
  secret  = "techtools_s4_extensao_access_token_secret"
  version = "latest"
}

data "google_secret_manager_secret_version" "encryption_key" {
  project = var.project_id
  secret  = "techtools_s4_extensao_encryption_key"
  version = "latest"
}

data "google_secret_manager_secret_version" "rabbitmq_url" {
  project = var.project_id
  secret  = "techtools_s4_extensao_rabbitmq_url"
  version = "latest"
}

data "google_secret_manager_secret_version" "email_password" {
  project = var.project_id
  secret  = "techtools_s4_extensao_email_password"
  version = "latest"
}

data "google_secret_manager_secret_version" "s4_hana_cloud_client_id" {
  project = var.project_id
  secret  = "techtools_s4_extensao_s4_hanna_cloud_client_id"
  version = "latest"
}

data "google_secret_manager_secret_version" "s4_hana_cloud_client_secret" {
  project = var.project_id
  secret  = "techtools_s4_extensao_s4_hanna_cloud_client_secret"
  version = "latest"
}

data "google_secret_manager_secret_version" "vexpenses_token_api" {
  project = var.project_id
  secret  = "techtools_s4_extensao_vexpenses_token_api"
  version = "latest"
}

data "google_secret_manager_secret_version" "bankplus_invent_username" {
  project = var.project_id
  secret  = "techtools_s4_extensao_bankplus_invent_username"
  version = "latest"
}

data "google_secret_manager_secret_version" "bankplus_invent_password" {
  project = var.project_id
  secret  = "techtools_s4_extensao_bankplus_invent_password"
  version = "latest"
}

data "google_secret_manager_secret_version" "relatorio_readonly_database_url" {
  project = var.project_id
  secret  = "techtools_s4_extensao_relatorio_readonly_database_url"
  version = "latest"
}

#endregion

#region [public environment variables]

resource "helm_release" "services" {
  name                = var.prefix
  repository          = "oci://ghcr.io/dotzinc/helm-chart"
  repository_username = "dotz-devops"
  repository_password = data.google_secret_manager_secret_version.github_token.secret_data
  chart               = "multi_services"
  version             = "1.0.6"
  namespace           = var.prefix
  force_update        = true
  cleanup_on_fail     = true
  reuse_values        = false
  dependency_update   = true
  recreate_pods       = false
  wait                = true
  max_history         = 1

  values = [
    file("${var.helm_values_path}"),
  ]

  set {
    name  = "image"
    value = local.container_image
  }

  set {
    name  = "namespace"
    value = var.prefix
  }

  set {
    name  = "serviceAccount.enabled"
    value = true
  }

  set {
    name  = "secret.data.GOOGLE_APPLICATION_CREDENTIALS"
    value = "/app/secrets/credentials.json"
  }

  set {
    name  = "secret.data.ELASTIC_APM_SECRET_TOKEN"
    value = data.google_secret_manager_secret_version.elastic_token.secret_data
  }

  set {
    name  = "secret.data.DATABASE_URL"
    value = data.google_secret_manager_secret_version.database_url.secret_data
  }

  set {
    name  = "secret.data.DOTZ_STAGE_DATABASE_URL"
    value = data.google_secret_manager_secret_version.dotz_stage_database_url.secret_data
  }
  set {
    name  = "secret.data.APP_API_KEY"
    value = data.google_secret_manager_secret_version.app_api_key.secret_data
  }

  set {
    name  = "secret.data.ACCESS_TOKEN_SECRET"
    value = data.google_secret_manager_secret_version.access_token_secret.secret_data
  }

  set {
    name  = "secret.data.ENCRYPTION_KEY"
    value = data.google_secret_manager_secret_version.encryption_key.secret_data
  }

  set {
    name  = "secret.data.RABBITMQ_URL"
    value = data.google_secret_manager_secret_version.rabbitmq_url.secret_data
  }

  set {
    name  = "secret.data.EMAIL_PASSWORD"
    value = data.google_secret_manager_secret_version.email_password.secret_data
  }

  set {
    name  = "secret.data.S4_HANA_CLOUD_CLIENT_ID"
    value = data.google_secret_manager_secret_version.s4_hana_cloud_client_id.secret_data
  }

  set {
    name  = "secret.data.S4_HANA_CLOUD_CLIENT_SECRET"
    value = data.google_secret_manager_secret_version.s4_hana_cloud_client_secret.secret_data
  }

  set {
    name  = "secret.data.VEXPENSES_TOKEN_API"
    value = data.google_secret_manager_secret_version.vexpenses_token_api.secret_data
  }
  set {
    name  = "secret.data.BANKPLUS_INVENT_USERNAME"
    value = data.google_secret_manager_secret_version.bankplus_invent_username.secret_data
  }

  set {
    name  = "secret.data.BANKPLUS_INVENT_PASSWORD"
    value = data.google_secret_manager_secret_version.bankplus_invent_password.secret_data
  }

  set {
    name  = "secret.data.RELATORIO_READONLY_DATABASE_URL"
    value = data.google_secret_manager_secret_version.relatorio_readonly_database_url.secret_data
  }

  dynamic "set" {
    for_each = yamldecode(file(var.envs_path))
    content {
      name  = "secret.data.${set.key}"
      value = replace(set.value == null ? "" : tostring(set.value), ",", "\\,")
    }
  }

  depends_on = [kubernetes_namespace_v1.services_namespace, kubernetes_secret.google-application-credentials]

  #endregion
}
