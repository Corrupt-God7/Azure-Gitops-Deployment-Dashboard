resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

module "network" {
  source              = "./modules/network"
  name                = "vnet-${var.project}-${var.environment}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
}

module "monitoring" {
  source              = "./modules/monitoring"
  name                = "log-${var.project}-${var.environment}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
}

module "acr" {
  source              = "./modules/acr"
  name                = var.acr_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
}

module "aks" {
  source                     = "./modules/aks"
  name                       = "aks-${var.project}-${var.environment}"
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  subnet_id                  = module.network.aks_subnet_id
  log_analytics_workspace_id = module.monitoring.workspace_id
  node_count                 = var.node_count
  node_vm_size               = var.node_vm_size
}

resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = module.acr.id
  role_definition_name = "AcrPull"
  principal_id         = module.aks.kubelet_identity_object_id
}
