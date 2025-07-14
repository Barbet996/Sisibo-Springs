// Data Management Module
class InventoryData {
    constructor() {
        this.items = this.loadItems();
        this.sales = this.loadSales();
        this.transfers = this.loadTransfers();
        this.adjustments = this.loadAdjustments();
        this.deletedItems = this.loadDeletedItems();
        this.deletedRecords = this.loadDeletedRecords();
        this.users = this.loadUsers();
        this.managerStock = this.loadManagerStock();
        this.staffStock = this.loadStaffStock();
    }

    // Users Management
    loadUsers() {
        const defaultUsers = {
            'admin': { password: 'admin123', role: 'admin', name: 'Administrator', profilePicture: null },
            'manager': { password: 'manager123', role: 'manager', name: 'Manager', profilePicture: null },
            'staff1': { password: 'staff123', role: 'staff', name: 'Staff Member 1', profilePicture: null },
            'staff2': { password: 'staff456', role: 'staff', name: 'Staff Member 2', profilePicture: null },
            'staff3': { password: 'staff789', role: 'staff', name: 'Staff Member 3', profilePicture: null }
        };
        
        const stored = localStorage.getItem('inventory_users');
        return stored ? { ...defaultUsers, ...JSON.parse(stored) } : defaultUsers;
    }

    saveUsers() {
        localStorage.setItem('inventory_users', JSON.stringify(this.users));
    }

    addUser(username, password, role, name) {
        if (this.users[username]) {
            return null; // User already exists
        }
        
        this.users[username] = {
            password,
            role,
            name,
            profilePicture: null,
            createdAt: new Date().toISOString(),
            createdBy: AuthManager.getCurrentUser()?.name || 'System'
        };
        
        this.saveUsers();
        return this.users[username];
    }

    updateUser(username, updates) {
        if (this.users[username]) {
            this.users[username] = { ...this.users[username], ...updates };
            this.saveUsers();
            return this.users[username];
        }
        return null;
    }

    // Manager Stock Management
    loadManagerStock() {
        return JSON.parse(localStorage.getItem('inventory_manager_stock') || '[]');
    }

    saveManagerStock() {
        localStorage.setItem('inventory_manager_stock', JSON.stringify(this.managerStock));
    }

    transferToManager(itemId, quantity) {
        const item = this.getItem(itemId);
        if (!item || item.quantity < quantity) {
            return null;
        }

        // Check if manager already has this item
        const existingStock = this.managerStock.find(stock => stock.itemId === itemId);
        
        if (existingStock) {
            existingStock.quantity += quantity;
        } else {
            this.managerStock.push({
                id: Date.now().toString(),
                itemId,
                itemName: item.name,
                quantity,
                price: item.price,
                transferredAt: new Date().toISOString()
            });
        }

        // Reduce from main inventory
        this.updateItemQuantity(itemId, item.quantity - quantity);
        this.saveManagerStock();
        return true;
    }

    getManagerStock() {
        return this.managerStock;
    }

    updateManagerStock(itemId, newQuantity) {
        const stock = this.managerStock.find(s => s.itemId === itemId);
        if (stock) {
            stock.quantity = newQuantity;
            this.saveManagerStock();
        }
    }

    // Staff Stock Management
    loadStaffStock() {
        return JSON.parse(localStorage.getItem('inventory_staff_stock') || '{}');
    }

    saveStaffStock() {
        localStorage.setItem('inventory_staff_stock', JSON.stringify(this.staffStock));
    }

    transferToStaff(staffUsername, itemId, quantity) {
        const managerStock = this.managerStock.find(stock => stock.itemId === itemId);
        if (!managerStock || managerStock.quantity < quantity) {
            return null;
        }

        // Initialize staff stock if not exists
        if (!this.staffStock[staffUsername]) {
            this.staffStock[staffUsername] = [];
        }

        // Check if staff already has this item
        const existingStock = this.staffStock[staffUsername].find(stock => stock.itemId === itemId);
        
        if (existingStock) {
            existingStock.quantity += quantity;
        } else {
            this.staffStock[staffUsername].push({
                id: Date.now().toString(),
                itemId,
                itemName: managerStock.itemName,
                quantity,
                price: managerStock.price,
                transferredAt: new Date().toISOString(),
                transferredBy: 'manager'
            });
        }

        // Reduce from manager stock
        managerStock.quantity -= quantity;
        if (managerStock.quantity === 0) {
            const index = this.managerStock.findIndex(s => s.itemId === itemId);
            this.managerStock.splice(index, 1);
        }

        this.saveManagerStock();
        this.saveStaffStock();
        return true;
    }

    getStaffStock(staffUsername) {
        return this.staffStock[staffUsername] || [];
    }

    updateStaffStock(staffUsername, itemId, newQuantity) {
        if (this.staffStock[staffUsername]) {
            const stock = this.staffStock[staffUsername].find(s => s.itemId === itemId);
            if (stock) {
                stock.quantity = newQuantity;
                this.saveStaffStock();
            }
        }
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

    addSale(itemId, customerName, quantitySold, discount, paymentMethod, soldBy = null) {
        const currentUser = AuthManager.getCurrentUser();
        let item = null;
        let stockSource = 'main';

        // Determine stock source based on user role
        if (currentUser.role === 'staff') {
            const staffStock = this.getStaffStock(currentUser.username);
            item = staffStock.find(s => s.itemId === itemId);
            stockSource = 'staff';
        } else if (currentUser.role === 'manager') {
            const managerStock = this.getManagerStock();
            item = managerStock.find(s => s.itemId === itemId);
            stockSource = 'manager';
        } else {
            item = this.getItem(itemId);
        }

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
            itemName: item.name || item.itemName,
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
            closingStock: openingStock - quantitySold,
            soldBy: soldBy || currentUser.name,
            soldByRole: currentUser.role,
            soldByUsername: currentUser.username,
            stockSource
        };

        this.sales.push(sale);

        // Update appropriate stock
        if (stockSource === 'staff') {
            this.updateStaffStock(currentUser.username, itemId, openingStock - quantitySold);
        } else if (stockSource === 'manager') {
            this.updateManagerStock(itemId, openingStock - quantitySold);
        } else {
            this.updateItemQuantity(itemId, openingStock - quantitySold);
        }

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
            
            // Restore the quantity based on stock source
            if (deletedSale.stockSource === 'staff') {
                const staffStock = this.getStaffStock(deletedSale.soldByUsername);
                const stockItem = staffStock.find(s => s.itemId === deletedSale.itemId);
                if (stockItem) {
                    this.updateStaffStock(deletedSale.soldByUsername, deletedSale.itemId, stockItem.quantity + deletedSale.quantitySold);
                }
            } else if (deletedSale.stockSource === 'manager') {
                const managerStock = this.getManagerStock();
                const stockItem = managerStock.find(s => s.itemId === deletedSale.itemId);
                if (stockItem) {
                    this.updateManagerStock(deletedSale.itemId, stockItem.quantity + deletedSale.quantitySold);
                }
            } else {
                const item = this.getItem(deletedSale.itemId);
                if (item) {
                    this.updateItemQuantity(deletedSale.itemId, item.quantity + deletedSale.quantitySold);
                }
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
            
            // Check stock availability and restore
            let canRestore = false;
            if (restoredSale.stockSource === 'staff') {
                const staffStock = this.getStaffStock(restoredSale.soldByUsername);
                const stockItem = staffStock.find(s => s.itemId === restoredSale.itemId);
                if (stockItem && stockItem.quantity >= restoredSale.quantitySold) {
                    this.updateStaffStock(restoredSale.soldByUsername, restoredSale.itemId, stockItem.quantity - restoredSale.quantitySold);
                    canRestore = true;
                }
            } else if (restoredSale.stockSource === 'manager') {
                const managerStock = this.getManagerStock();
                const stockItem = managerStock.find(s => s.itemId === restoredSale.itemId);
                if (stockItem && stockItem.quantity >= restoredSale.quantitySold) {
                    this.updateManagerStock(restoredSale.itemId, stockItem.quantity - restoredSale.quantitySold);
                    canRestore = true;
                }
            } else {
                const item = this.getItem(restoredSale.itemId);
                if (item && item.quantity >= restoredSale.quantitySold) {
                    this.updateItemQuantity(restoredSale.itemId, item.quantity - restoredSale.quantitySold);
                    canRestore = true;
                }
            }

            if (canRestore) {
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

    addTransfer(itemId, personName, quantityTransferred, transferType = 'staff') {
        const currentUser = AuthManager.getCurrentUser();
        let item = null;
        let stockSource = 'main';

        if (currentUser.role === 'admin') {
            item = this.getItem(itemId);
            stockSource = 'main';
        } else if (currentUser.role === 'manager') {
            const managerStock = this.getManagerStock();
            item = managerStock.find(s => s.itemId === itemId);
            stockSource = 'manager';
        }

        if (!item || item.quantity < quantityTransferred) {
            return null;
        }

        const openingStock = item.quantity;
        const transfer = {
            id: Date.now().toString(),
            itemId,
            itemName: item.name || item.itemName,
            personName,
            quantityTransferred: parseInt(quantityTransferred),
            date: new Date().toISOString(),
            openingStock,
            closingStock: openingStock - quantityTransferred,
            transferredBy: currentUser.name,
            transferredByRole: currentUser.role,
            transferredByUsername: currentUser.username,
            transferType,
            stockSource
        };

        this.transfers.push(transfer);

        // Handle the actual transfer based on user role
        if (currentUser.role === 'admin' && transferType === 'manager') {
            this.transferToManager(itemId, quantityTransferred);
        } else if (currentUser.role === 'manager' && transferType === 'staff') {
            this.transferToStaff(personName, itemId, quantityTransferred);
        } else {
            // Regular transfer (reduce from current stock)
            if (stockSource === 'manager') {
                this.updateManagerStock(itemId, openingStock - quantityTransferred);
            } else {
                this.updateItemQuantity(itemId, openingStock - quantityTransferred);
            }
        }

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
            
            // Restore the quantity based on transfer type and source
            if (deletedTransfer.transferType === 'manager' && deletedTransfer.stockSource === 'main') {
                // Remove from manager stock and restore to main inventory
                const managerStock = this.getManagerStock();
                const stockItem = managerStock.find(s => s.itemId === deletedTransfer.itemId);
                if (stockItem) {
                    stockItem.quantity -= deletedTransfer.quantityTransferred;
                    if (stockItem.quantity <= 0) {
                        const index = this.managerStock.findIndex(s => s.itemId === deletedTransfer.itemId);
                        this.managerStock.splice(index, 1);
                    }
                    this.saveManagerStock();
                }
                
                const item = this.getItem(deletedTransfer.itemId);
                if (item) {
                    this.updateItemQuantity(deletedTransfer.itemId, item.quantity + deletedTransfer.quantityTransferred);
                }
            } else if (deletedTransfer.transferType === 'staff' && deletedTransfer.stockSource === 'manager') {
                // Remove from staff stock and restore to manager stock
                const staffStock = this.getStaffStock(deletedTransfer.personName);
                const stockItem = staffStock.find(s => s.itemId === deletedTransfer.itemId);
                if (stockItem) {
                    stockItem.quantity -= deletedTransfer.quantityTransferred;
                    if (stockItem.quantity <= 0) {
                        const index = this.staffStock[deletedTransfer.personName].findIndex(s => s.itemId === deletedTransfer.itemId);
                        this.staffStock[deletedTransfer.personName].splice(index, 1);
                    }
                    this.saveStaffStock();
                }
                
                const managerStock = this.getManagerStock();
                const managerStockItem = managerStock.find(s => s.itemId === deletedTransfer.itemId);
                if (managerStockItem) {
                    managerStockItem.quantity += deletedTransfer.quantityTransferred;
                } else {
                    const item = this.getItem(deletedTransfer.itemId);
                    if (item) {
                        this.managerStock.push({
                            id: Date.now().toString(),
                            itemId: deletedTransfer.itemId,
                            itemName: deletedTransfer.itemName,
                            quantity: deletedTransfer.quantityTransferred,
                            price: item.price,
                            transferredAt: new Date().toISOString()
                        });
                    }
                }
                this.saveManagerStock();
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
            
            // Check if we can restore the transfer
            let canRestore = false;
            
            if (restoredTransfer.transferType === 'manager' && restoredTransfer.stockSource === 'main') {
                const item = this.getItem(restoredTransfer.itemId);
                if (item && item.quantity >= restoredTransfer.quantityTransferred) {
                    this.transferToManager(restoredTransfer.itemId, restoredTransfer.quantityTransferred);
                    canRestore = true;
                }
            } else if (restoredTransfer.transferType === 'staff' && restoredTransfer.stockSource === 'manager') {
                const managerStock = this.getManagerStock();
                const stockItem = managerStock.find(s => s.itemId === restoredTransfer.itemId);
                if (stockItem && stockItem.quantity >= restoredTransfer.quantityTransferred) {
                    this.transferToStaff(restoredTransfer.personName, restoredTransfer.itemId, restoredTransfer.quantityTransferred);
                    canRestore = true;
                }
            }

            if (canRestore) {
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

    addAdjustment(itemId, newQuantity, reason, targetUser = null) {
        const currentUser = AuthManager.getCurrentUser();
        let item = null;
        let stockSource = 'main';

        if (currentUser.role === 'admin') {
            if (targetUser && targetUser !== 'admin') {
                if (targetUser === 'manager') {
                    const managerStock = this.getManagerStock();
                    item = managerStock.find(s => s.itemId === itemId);
                    stockSource = 'manager';
                } else {
                    // Staff adjustment
                    const staffStock = this.getStaffStock(targetUser);
                    item = staffStock.find(s => s.itemId === itemId);
                    stockSource = 'staff';
                }
            } else {
                item = this.getItem(itemId);
                stockSource = 'main';
            }
        } else if (currentUser.role === 'manager') {
            // Manager can only adjust staff stock
            if (targetUser && this.users[targetUser]?.role === 'staff') {
                const staffStock = this.getStaffStock(targetUser);
                item = staffStock.find(s => s.itemId === itemId);
                stockSource = 'staff';
            }
        }

        if (!item) {
            return null;
        }

        const adjustment = {
            id: Date.now().toString(),
            itemId,
            itemName: item.name || item.itemName,
            oldQuantity: item.quantity,
            newQuantity: parseInt(newQuantity),
            reason,
            date: new Date().toISOString(),
            adjustedBy: currentUser.name,
            adjustedByRole: currentUser.role,
            adjustedByUsername: currentUser.username,
            targetUser: targetUser || currentUser.username,
            stockSource
        };

        this.adjustments.push(adjustment);

        // Update appropriate stock
        if (stockSource === 'manager') {
            this.updateManagerStock(itemId, newQuantity);
        } else if (stockSource === 'staff') {
            this.updateStaffStock(targetUser, itemId, newQuantity);
        } else {
            this.updateItemQuantity(itemId, newQuantity);
        }

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
            
            // Restore the original quantity based on stock source
            if (deletedAdjustment.stockSource === 'manager') {
                this.updateManagerStock(deletedAdjustment.itemId, deletedAdjustment.oldQuantity);
            } else if (deletedAdjustment.stockSource === 'staff') {
                this.updateStaffStock(deletedAdjustment.targetUser, deletedAdjustment.itemId, deletedAdjustment.oldQuantity);
            } else {
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
            
            // Apply the adjustment again based on stock source
            if (restoredAdjustment.stockSource === 'manager') {
                this.updateManagerStock(restoredAdjustment.itemId, restoredAdjustment.newQuantity);
            } else if (restoredAdjustment.stockSource === 'staff') {
                this.updateStaffStock(restoredAdjustment.targetUser, restoredAdjustment.itemId, restoredAdjustment.newQuantity);
            } else {
                this.updateItemQuantity(restoredAdjustment.itemId, restoredAdjustment.newQuantity);
            }
            
            this.adjustments.push(restoredAdjustment);
            this.deletedRecords.splice(deletedIndex, 1);
            
            this.saveAdjustments();
            this.saveDeletedRecords();
            return restoredAdjustment;
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

    // Get sales by user
    getSalesByUser(username) {
        return this.sales.filter(sale => sale.soldByUsername === username);
    }

    // Get transfers by user
    getTransfersByUser(username) {
        return this.transfers.filter(transfer => transfer.transferredByUsername === username);
    }

    // Get adjustments by user
    getAdjustmentsByUser(username) {
        return this.adjustments.filter(adjustment => adjustment.adjustedByUsername === username);
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
                // Redirect to manager dashboard
                window.location.href = 'manager-dashboard.html';
                break;
            case 'staff':
                // Redirect to staff dashboard
                window.location.href = 'staff-dashboard.html';
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
                'sale-records', 'transfer-records', 'stock-adjust', 'adjustment-records',
                'user-management'
            ],
            'manager': [
                'sell-items', 'transfer-stock', 'sale-records', 'transfer-records',
                'stock-summary', 'adjustment-records'
            ],
            'staff': ['sell-items', 'sale-records', 'stock-summary']
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

    static updateCurrentUser(updates) {
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            const updatedUser = { ...currentUser, ...updates };
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            return updatedUser;
        }
        return null;
    }
}

// Global instance
const inventoryData = new InventoryData();