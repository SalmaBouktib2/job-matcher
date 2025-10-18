variable "project_id" {
  description = "The GCP project ID."
  type        = string
}

variable "region" {
  description = "The GCP region to deploy resources."
  type        = string
  default     = "eu" 
}

variable "frontend_bucket_name" {
  description = "Name of the GCS bucket for the static frontend."
  type        = string
  default     = "resume-matcher-frontend"
}

variable "keyword_data_bucket_name" {
  description = "Name of the GCS bucket for keyword dictionaries."
  type        = string
  default     = "resume-matcher-keywords"
}

variable "document_ai_processor_id" {
  description = "ID of the Document AI OCR processor. Format: projects/PROJECT_NUMBER/locations/REGION/processors/PROCESSOR_ID"
  type        = string
}