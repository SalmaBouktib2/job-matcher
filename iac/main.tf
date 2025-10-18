# GCS Bucket for Frontend (Static Website Hosting)
resource "google_storage_bucket" "frontend_bucket" {
  name          = var.frontend_bucket_name
  location      = "US" # Multi-region for frontend for simplicity
  project       = var.project_id
  uniform_bucket_level_access = true
  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html" # Fallback to index for SPA routes
  }
  force_destroy = true # For easy cleanup during testing
}

# GCS Bucket for Keyword Data
resource "google_storage_bucket" "keyword_data_bucket" {
  name          = var.keyword_data_bucket_name
  location      = var.region
  project       = var.project_id
  uniform_bucket_level_access = true
  force_destroy = true
}

# Create a Service Account for the Cloud Function
resource "google_service_account" "cf_service_account" {
  account_id   = "resume-matcher-cf-sa"
  display_name = "Service Account for Resume Matcher Cloud Function"
  project      = var.project_id
}

# Grant necessary permissions to the Cloud Function Service Account
resource "google_project_iam_member" "cf_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.cf_service_account.email}"
}

resource "google_project_iam_member" "cf_documentai_user" {
  project = var.project_id
  role    = "roles/documentai.user"
  member  = "serviceAccount:${google_service_account.cf_service_account.email}"
}

# Cloud Function (code will be deployed by Cloud Build later)
resource "google_cloudfunctions_function" "resume_matcher_cf" {
  name                  = "match-resume"
  runtime               = "python310" # Or python39, python311
  project               = var.project_id
  region                = var.region
  entry_point           = "match_resume"
  source_archive_bucket = google_storage_bucket.frontend_bucket.name # Temp bucket for source
  source_archive_object = "function_source.zip" # Placeholder, Cloud Build uploads real source
  timeout               = 300 # 5 minutes for Document AI
  available_memory_mb   = 512 # Adjust as needed
  trigger_http          = true
  service_account_email = google_service_account.cf_service_account.email
  environment_variables = {
    KEYWORD_DATA_BUCKET = google_storage_bucket.keyword_data_bucket.name
    DOCUMENT_AI_PROCESSOR_ID = var.document_ai_processor_id
    # Example: if you have a default OCR processor, you can use:
    # DOCUMENT_AI_PROCESSOR_ID = "projects/${var.project_id}/locations/${var.region}/processors/ocr-processor"
  }
}

# Output the frontend URL for easy access
output "frontend_url" {
  description = "URL for the static frontend website."
  value       = "http://${google_storage_bucket.frontend_bucket.name}/index.html"
}

# Output Cloud Function URL for frontend to use
output "cloud_function_url" {
  description = "URL of the deployed Cloud Function."
  value       = google_cloudfunctions_function.resume_matcher_cf.https_trigger_url
}