variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }

resource "azurerm_virtual_network" "this" {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = ["10.20.0.0/16"]
}

resource "azurerm_subnet" "aks" {
  name                 = "snet-aks"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = ["10.20.0.0/22"]
}

output "aks_subnet_id" { value = azurerm_subnet.aks.id }
