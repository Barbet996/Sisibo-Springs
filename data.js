// Data Management Module
class InventoryData {
    constructor() {
        this.items = this.loadItems();
        this.sales = this.loadSales();
        this.transfers = this.loadTransfers();
        this.adjustments = this.loadAdjustments();
        this.deletedItems = this.loadDeletedItems();
        this.deletedRecords = this.loadDeletedRecords();
    }

    // Items Management
    loadItems() {
        return JSON.parse(localStorage.getItem('inventory_items') || '[]');
    }

    saveItems() {
        localStorage.setItem('inventory_items', JSON.stringify(this.items));
    }

    loadDeletedItems() {
        return JSON.parse(localStorage.getItem('inventory_deleted_items') || '[]');
    }

    saveDeletedItems() {
        localStorage.setItem('inventory_deleted_items', JSON.stringify(this.deletedItems));
    }

    loadDeletedRecords() {
        return JSON.parse(localStorage.getItem('inventory_deleted_records') || '[]');
    }

    saveDeletedRecords() {
        localStorage.setItem('inventory_deleted_records', JSON.stringify(this.deletedRecords));
    }

    addItem(name, price, quantity, dateAdded) {
        const item = {
            id: Date.now().toString(),
            name,
            price: parseFloat(price),
            quantity: parseInt(quantity),
            originalQuantity: parseInt(quantity),
            dateAdded: dateAdded || new Date().toISOString().split('T')[0]
        };
        this.items.push(item);
        this.saveItems();
        return item;
    }

    updateItemQuantity(itemId, newQuantity) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            item.quantity = newQuantity;
            this.saveItems();
        }
    }

    getItem(itemId) {
        return this.items.find(i => i.id === itemId);
    }

    // Delete item (soft delete)
    deleteItem(itemId) {
        const itemIndex = this.items.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
            const deletedItem = {
                ...this.items[itemIndex],
                deletedAt: new Date().toISOString(),
                deletedBy: AuthManager.getCurrentUser()?.name || 'Unknown'
            };
            
            this.deletedItems.push(deletedItem);
            this.items.splice(itemIndex, 1);
            
            this.saveItems();
            this.saveDeletedItems();
            return deletedItem;
        }
        return null;
    }

    // Restore deleted item
    restoreItem(itemId) {
        const deletedIndex = this.deletedItems.findIndex(i => i.id === itemId);
        if (deletedIndex !== -1) {
            const restoredItem = { ...this.deletedItems[deletedIndex] };
            delete restoredItem.deletedAt;
            delete restoredItem.deletedBy;
            
            this.items.push(restoredItem);
            this.deletedItems.splice(deletedIndex, 1);
            
            this.saveItems();
            this.saveDeletedItems();
            return restoredItem;
        }
        return null;
    }

    // Sales Management
    loadSales() {
        return JSON.parse(localStorage.getItem('inventory_sales') || '[]');
    }

    saveSales() {
        localStorage.setItem('inventory_sales', JSON.stringify(this.sales));
    }

    addSale(itemId, customerName, quantitySold, discount, paymentMethod) {
        const item = this.getItem(itemId);
        if (!item || item.quantity < quantitySold) {
            return null;
        }

        const openingStock = item.quantity;
        const subtotal = item.price * quantitySold;
        const discountAmount = (subtotal * discount) / 100;
        const totalPrice = subtotal - discountAmount;

        const sale = {
            id: Date.now().toString(),
            itemId,
            itemName: item.name,
            customerName,
            quantitySold: parseInt(quantitySold),
            unitPrice: item.price,
            subtotal,
            discount: parseFloat(discount),
            discountAmount,
            totalPrice,
            paymentMethod,
            date: new Date().toISOString(),
            openingStock,
            closingStock: openingStock - quantitySold
        };

        this.sales.push(sale);
        this.updateItemQuantity(itemId, openingStock - quantitySold);
        this.saveSales();
        return sale;
    }

    // Delete sale record
    deleteSaleRecord(saleId) {
        const saleIndex = this.sales.findIndex(s => s.id === saleId);
        if (saleIndex !== -1) {
            const deletedSale = {
                ...this.sales[saleIndex],
                recordType: 'sale',
                deletedAt: new Date().toISOString(),
                deletedBy: AuthManager.getCurrentUser()?.name || 'Unknown'
            };
            
            // Restore the quantity to the item
            const item = this.getItem(deletedSale.itemId);
            if (item) {
                this.updateItemQuantity(deletedSale.itemId, item.quantity + deletedSale.quantitySold);
            }
            
            this.deletedRecords.push(deletedSale);
            this.sales.splice(saleIndex, 1);
            
            this.saveSales();
            this.saveDeletedRecords();
            return deletedSale;
        }
        return null;
    }

    // Restore sale record
    restoreSaleRecord(saleId) {
        const deletedIndex = this.deletedRecords.findIndex(r => r.id === saleId && r.recordType === 'sale');
        if (deletedIndex !== -1) {
            const restoredSale = { ...this.deletedRecords[deletedIndex] };
            delete restoredSale.recordType;
            delete restoredSale.deletedAt;
            delete restoredSale.deletedBy;
            
            // Check if item still exists and has enough quantity
            const item = this.getItem(restoredSale.itemId);
            if (item && item.quantity >= restoredSale.quantitySold) {
                this.updateItemQuantity(restoredSale.itemId, item.quantity - restoredSale.quantitySold);
                this.sales.push(restoredSale);
                this.deletedRecords.splice(deletedIndex, 1);
                
                this.saveSales();
                this.saveDeletedRecords();
                return restoredSale;
            }
        }
        return null;
    }

    // Transfers Management
    loadTransfers() {
        return JSON.parse(localStorage.getItem('inventory_transfers') || '[]');
    }

    saveTransfers() {
        localStorage.setItem('inventory_transfers', JSON.stringify(this.transfers));
    }

    addTransfer(itemId, personName, quantityTransferred) {
        const item = this.getItem(itemId);
        if (!item || item.quantity < quantityTransferred) {
            return null;
        }

        const openingStock = item.quantity;
        const transfer = {
            id: Date.now().toString(),
            itemId,
            itemName: item.name,
            personName,
            quantityTransferred: parseInt(quantityTransferred),
            date: new Date().toISOString(),
            openingStock,
            closingStock: openingStock - quantityTransferred
        };

        this.transfers.push(transfer);
        this.updateItemQuantity(itemId, openingStock - quantityTransferred);
        this.saveTransfers();
        return transfer;
    }

    // Delete transfer record
    deleteTransferRecord(transferId) {
        const transferIndex = this.transfers.findIndex(t => t.id === transferId);
        if (transferIndex !== -1) {
            const deletedTransfer = {
                ...this.transfers[transferIndex],
                recordType: 'transfer',
                deletedAt: new Date().toISOString(),
                deletedBy: AuthManager.getCurrentUser()?.name || 'Unknown'
            };
            
            // Restore the quantity to the item
            const item = this.getItem(deletedTransfer.itemId);
            if (item) {
                this.updateItemQuantity(deletedTransfer.itemId, item.quantity + deletedTransfer.quantityTransferred);
            }
            
            this.deletedRecords.push(deletedTransfer);
            this.transfers.splice(transferIndex, 1);
            
            this.saveTransfers();
            this.saveDeletedRecords();
            return deletedTransfer;
        }
        return null;
    }

    // Restore transfer record
    restoreTransferRecord(transferId) {
        const deletedIndex = this.deletedRecords.findIndex(r => r.id === transferId && r.recordType === 'transfer');
        if (deletedIndex !== -1) {
            const restoredTransfer = { ...this.deletedRecords[deletedIndex] };
            delete restoredTransfer.recordType;
            delete restoredTransfer.deletedAt;
            delete restoredTransfer.deletedBy;
            
            // Check if item still exists and has enough quantity
            const item = this.getItem(restoredTransfer.itemId);
            if (item && item.quantity >= restoredTransfer.quantityTransferred) {
                this.updateItemQuantity(restoredTransfer.itemId, item.quantity - restoredTransfer.quantityTransferred);
                this.transfers.push(restoredTransfer);
                this.deletedRecords.splice(deletedIndex, 1);
                
                this.saveTransfers();
                this.saveDeletedRecords();
                return restoredTransfer;
            }
        }
        return null;
    }

    // Adjustments Management
    loadAdjustments() {
        return JSON.parse(localStorage.getItem('inventory_adjustments') || '[]');
    }

    saveAdjustments() {
        localStorage.setItem('inventory_adjustments', JSON.stringify(this.adjustments));
    }

    addAdjustment(itemId, newQuantity, reason) {
        const item = this.getItem(itemId);
        if (!item) {
            return null;
        }

        const adjustment = {
            id: Date.now().toString(),
            itemId,
            itemName: item.name,
            oldQuantity: item.quantity,
            newQuantity: parseInt(newQuantity),
            reason,
            date: new Date().toISOString()
        };

        this.adjustments.push(adjustment);
        this.updateItemQuantity(itemId, newQuantity);
        this.saveAdjustments();
        return adjustment;
    }

    // Delete adjustment record
    deleteAdjustmentRecord(adjustmentId) {
        const adjustmentIndex = this.adjustments.findIndex(a => a.id === adjustmentId);
        if (adjustmentIndex !== -1) {
            const deletedAdjustment = {
                ...this.adjustments[adjustmentIndex],
                recordType: 'adjustment',
                deletedAt: new Date().toISOString(),
                deletedBy: AuthManager.getCurrentUser()?.name || 'Unknown'
            };
            
            // Restore the original quantity to the item
            const item = this.getItem(deletedAdjustment.itemId);
            if (item) {
                this.updateItemQuantity(deletedAdjustment.itemId, deletedAdjustment.oldQuantity);
            }
            
            this.deletedRecords.push(deletedAdjustment);
            this.adjustments.splice(adjustmentIndex, 1);
            
            this.saveAdjustments();
            this.saveDeletedRecords();
            return deletedAdjustment;
        }
        return null;
    }

    // Restore adjustment record
    restoreAdjustmentRecord(adjustmentId) {
        const deletedIndex = this.deletedRecords.findIndex(r => r.id === adjustmentId && r.recordType === 'adjustment');
        if (deletedIndex !== -1) {
            const restoredAdjustment = { ...this.deletedRecords[deletedIndex] };
            delete restoredAdjustment.recordType;
            delete restoredAdjustment.deletedAt;
            delete restoredAdjustment.deletedBy;
            
            // Apply the adjustment again
            const item = this.getItem(restoredAdjustment.itemId);
            if (item) {
                this.updateItemQuantity(restoredAdjustment.itemId, restoredAdjustment.newQuantity);
                this.adjustments.push(restoredAdjustment);
                this.deletedRecords.splice(deletedIndex, 1);
                
                this.saveAdjustments();
                this.saveDeletedRecords();
                return restoredAdjustment;
            }
        }
        return null;
    }

    // Utility Methods
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES'
        }).format(amount);
    }

    // Get recently deleted items (last 24 hours)
    getRecentlyDeletedItems() {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return this.deletedItems.filter(item => new Date(item.deletedAt) > oneDayAgo);
    }

    // Get recently deleted records (last 24 hours)
    getRecentlyDeletedRecords() {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return this.deletedRecords.filter(record => new Date(record.deletedAt) > oneDayAgo);
    }
}

// Authentication Management
class AuthManager {
    static checkAuth() {
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
            window.location.href = 'login.html';
            return null;
        }
        return JSON.parse(currentUser);
    }

    static checkRole(requiredRoles) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            window.location.href = 'login.html';
            return false;
        }
        
        // If requiredRoles is a string, convert to array
        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
        
        if (!roles.includes(currentUser.role)) {
            // Redirect to appropriate page based on role
            this.redirectToAuthorizedPage(currentUser.role);
            return false;
        }
        
        return true;
    }

    static redirectToAuthorizedPage(userRole) {
        switch(userRole) {
            case 'admin':
                // Admin has access to everything, shouldn't reach here
                window.location.href = 'index.html';
                break;
            case 'manager':
                // Redirect to sell page (manager's main function)
                window.location.href = 'sell.html';
                break;
            case 'staff':
                // Redirect to sell page (staff's only function)
                window.location.href = 'sell.html';
                break;
            default:
                window.location.href = 'login.html';
        }
    }

    static hasAccess(feature) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return false;
        
        const permissions = {
            'admin': [
                'add-items', 'stock-summary', 'sell-items', 'transfer-stock',
                'sale-records', 'transfer-records', 'stock-adjust', 'adjustment-records'
            ],
            'manager': ['sell-items', 'transfer-stock'],
            'staff': ['sell-items']
        };
        
        return permissions[currentUser.role]?.includes(feature) || false;
    }
    static logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }

    static getCurrentUser() {
        const currentUser = localStorage.getItem('currentUser');
        return currentUser ? JSON.parse(currentUser) : null;
    }
}

// Global instance
const inventoryData = new InventoryData();