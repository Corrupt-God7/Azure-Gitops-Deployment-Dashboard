output "resource_group_name" { value = azurerm_resource_group.this.name }
output "acr_login_server" { value = module.acr.login_server }
output "aks_cluster_name" { value = module.aks.name }
output "aks_oidc_issuer_url" { value = module.aks.oidc_issuer_url }
