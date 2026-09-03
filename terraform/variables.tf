variable "location" {
  description = "Azure region. Confirm quota before apply."
  type        = string
  default     = "Central India"
}

variable "resource_group_name" {
  type    = string
  default = "rg-gitops-dev"
}

variable "project" {
  type    = string
  default = "gitops"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "acr_name" {
  description = "Globally unique lowercase ACR name."
  type        = string
  default     = "acrgitopschirag"
}

variable "node_count" {
  type    = number
  default = 1
}

variable "node_vm_size" {
  type    = string
  default = "Standard_D2s_v5"
}

variable "tags" {
  type = map(string)
  default = {
    project     = "gitops-dashboard"
    environment = "dev"
    managed_by  = "terraform"
  }
}
