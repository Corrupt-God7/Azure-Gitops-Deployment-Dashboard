variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "subnet_id" { type = string }
variable "log_analytics_workspace_id" { type = string }
variable "node_count" { type = number }
variable "node_vm_size" { type = string }

resource "azurerm_kubernetes_cluster" "this" {
  name                      = var.name
  location                  = var.location
  resource_group_name       = var.resource_group_name
  dns_prefix                = var.name
  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  default_node_pool {
    name           = "system"
    node_count     = var.node_count
    vm_size        = var.node_vm_size
    vnet_subnet_id = var.subnet_id
  }

  identity { type = "SystemAssigned" }

  oms_agent {
    log_analytics_workspace_id = var.log_analytics_workspace_id
  }

  network_profile { network_plugin = "azure" }
}

output "name" { value = azurerm_kubernetes_cluster.this.name }
output "oidc_issuer_url" { value = azurerm_kubernetes_cluster.this.oidc_issuer_url }
output "kubelet_identity_object_id" { value = azurerm_kubernetes_cluster.this.kubelet_identity[0].object_id }
