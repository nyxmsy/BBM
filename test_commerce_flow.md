# Commerce Flow Testing Checklist

## Milestone 4: Checkout & Inventory Reliability Tests

### Test 1: Successful Checkout Flow
**Status**: ⏳ To be tested after database migration

**Steps**:
1. Navigate to shop page
2. Add product to cart
3. Proceed to checkout
4. Fill in customer details
5. Select COD payment
6. Submit order

**Expected Results**:
- Order is created successfully
- Order number is displayed
- Stock is decremented in products table
- Inventory movement is recorded with type 'sale'
- Order items are created correctly
- Cart is cleared
- User is redirected to order success page

**Database Verification**:
```sql
-- Check order was created
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;

-- Check stock was decremented
SELECT slug, stock FROM products WHERE slug = 'ceramic-dinner-set-24';

-- Check inventory movement was recorded
SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT 1;
```

### Test 2: Insufficient Stock Scenario
**Status**: ⏳ To be tested after database migration

**Steps**:
1. Find product with low stock (e.g., stock = 1)
2. Add 2+ units to cart
3. Attempt checkout

**Expected Results**:
- Checkout fails with clear error message
- No order is created
- Stock remains unchanged
- No inventory movements recorded

**Error Message**: "Insufficient stock for {product} (available: X, requested: Y)"

### Test 3: Cancellation and Inventory Restoration
**Status**: ⏳ To be tested after database migration

**Steps**:
1. Create an order successfully
2. Log in as admin/staff
3. Navigate to admin orders page
4. Change order status to "cancelled"

**Expected Results**:
- Order status updates to "cancelled"
- Stock is restored to previous level
- Inventory movement is recorded with type 'cancellation'
- Movement shows positive quantity change
- Movement references the order_id

**Database Verification**:
```sql
-- Check cancellation movement
SELECT * FROM inventory_movements 
WHERE movement_type = 'cancellation' 
ORDER BY created_at DESC LIMIT 1;

-- Verify stock restoration
SELECT slug, stock FROM products WHERE slug = 'ceramic-dinner-set-24';
```

### Test 4: Manual Inventory Adjustment
**Status**: ⏳ To be tested after database migration

**Steps**:
1. Log in as admin/staff
2. Navigate to inventory page
3. Select a product
4. Adjust stock (positive or negative)
5. Provide reason
6. Submit adjustment

**Expected Results**:
- Stock is updated correctly
- Inventory movement is recorded with type 'adjustment'
- Movement shows correct quantity change
- Movement includes provided reason
- Movement records which user made the change

**Database Verification**:
```sql
-- Check adjustment movement
SELECT * FROM inventory_movements 
WHERE movement_type = 'adjustment' 
ORDER BY created_at DESC LIMIT 1;
```

### Test 5: Invalid Product IDs/Quantities
**Status**: ⏳ To be tested after database migration

**Test Cases**:
- Non-existent product slug
- Invalid product ID format
- Negative quantities
- Zero quantities
- Excessive quantities (>100)

**Expected Results**:
- Appropriate error messages
- No database changes
- No partial order creation

### Test 6: Concurrent Checkout (Race Condition)
**Status**: ⏳ To be tested after database migration

**Steps**:
1. Have product with stock = 1
2. Two users simultaneously add to cart
3. Both attempt checkout simultaneously

**Expected Results**:
- One order succeeds, one fails
- Stock never goes negative
- Clear error message for failed checkout
- Proper FOR UPDATE locking prevents race condition

### Test 7: Inventory Movement Recording Accuracy
**Status**: ⏳ To be tested after database migration

**Verification Queries**:
```sql
-- All movements should have correct previous_stock and new_stock
SELECT movement_type, quantity_change, previous_stock, new_stock,
       (previous_stock + quantity_change) as calculated_new_stock,
       CASE WHEN (previous_stock + quantity_change) = new_stock 
            THEN 'CORRECT' ELSE 'INCORRECT' END as accuracy
FROM inventory_movements;

-- Movements should reference valid products
SELECT im.id, im.product_id, p.slug
FROM inventory_movements im
LEFT JOIN products p ON im.product_id = p.id
WHERE p.id IS NULL;

-- Movements should reference valid orders (except adjustments)
SELECT im.id, im.order_id, o.order_number
FROM inventory_movements im
LEFT JOIN orders o ON im.order_id = o.id
WHERE im.movement_type != 'adjustment' AND o.id IS NULL;
```

### Test 8: Order Status Flow Validation
**Status**: ⏳ To be tested after database migration

**Valid Transitions**:
- new → confirmed
- confirmed → out_for_delivery
- out_for_delivery → delivered
- any status → cancelled (except already cancelled)

**Invalid Transitions**:
- cancelled → any other status
- delivered → cancelled

**Expected Results**:
- Only valid transitions allowed
- Each transition creates appropriate system state
- Inventory restoration only on cancellation

---

## Milestone 3: Security Audit Results

### ✅ RLS Verification

**Tables with RLS Enabled**:
- ✅ `profiles` - Own profile read/write
- ✅ `user_roles` - Read own roles only
- ✅ `products` - Public read active, staff manage
- ✅ `orders` - Staff read/update, admin delete
- ✅ `order_items` - Staff read
- ✅ `product_images` - Public read, staff manage
- ✅ `inventory_movements` - Staff read/create

### ✅ Function Security

**create_cod_order()**:
- ✅ SECURITY DEFINER with search_path = public
- ✅ Stock validation before order creation
- ✅ FOR UPDATE locking prevents race conditions
- ✅ Grants: anon only (no authenticated needed)
- ✅ Cannot create negative stock

**update_order_status()**:
- ✅ SECURITY DEFINER with search_path = public
- ✅ Staff/admin authorization check via has_role()
- ✅ Automatic inventory restoration on cancellation
- ✅ Grants: authenticated only

**adjust_inventory()**:
- ✅ SECURITY DEFINER with search_path = public
- ✅ Staff/admin authorization check via has_role()
- ✅ Prevents negative stock
- ✅ Records user who made adjustment
- ✅ Grants: authenticated only

### ✅ View Security

**inventory_dashboard**:
- ✅ Security barrier enabled
- ✅ Grants: authenticated only
- ✅ REVOKE ALL from anon
- ✅ Based on RLS-protected tables

### ✅ Service Role Usage

**Limited to**:
- ✅ `claimFirstAdmin()` - First admin bootstrap only
- ✅ No other service role usage in application code
- ✅ Removed unused import from orders.functions.ts

### ✅ Anon vs Authenticated Protection

**Anon users can**:
- ✅ View active products
- ✅ View product images
- ✅ Create orders via create_cod_order()

**Anon users cannot**:
- ✅ Access admin functions
- ✅ View orders
- ✅ Modify inventory
- ✅ Access inventory dashboard

**Authenticated non-staff cannot**:
- ✅ Access admin routes (checked in UI)
- ✅ Perform staff operations (blocked by RLS)
- ✅ Update order status
- ✅ Adjust inventory

---

## Milestone 5: Production Audit Checklist

### Authentication & Session Persistence
- ✅ Session persists across page refreshes
- ✅ Language preference persists in localStorage
- ✅ Logout clears session properly
- ⏳ Test session expiration handling

### Staff Authorization
- ✅ All admin routes check staff role
- ✅ Admin layout enforces access control
- ✅ Database functions enforce authorization
- ⏳ Test unauthorized access attempts

### EN/AR Language Persistence
- ✅ Language preference stored in localStorage
- ✅ Language toggle works on login page
- ✅ Language toggle works in admin panel
- ✅ RTL support applied automatically
- ✅ Language persists across navigation
- ⏳ Test language persistence through logout/login

### Error Handling
- ✅ Try-catch blocks in server functions
- ✅ User-friendly error messages
- ✅ Loading states with spinners
- ⏳ Test network error handling
- ⏳ Test database error handling

### Loading/Empty States
- ✅ Loading spinners in admin pages
- ✅ Empty state messages in order list
- ✅ Empty state messages in product list
- ⏳ Test all loading scenarios

### Mobile Responsiveness
- ✅ Responsive design in main site
- ⏳ Test admin panel on mobile
- ⏳ Test checkout flow on mobile

### Build Configuration
- ⏳ Check TypeScript compilation
- ⏳ Verify environment variables
- ⏳ Test production build
- ⏳ Check for console errors

---

## Next Steps

1. Run database migration: `supabase db push`
2. Test checkout flow manually
3. Test admin operations manually
4. Run TypeScript compilation: `npm run build` or `tanstack build`
5. Test production build locally
6. Deploy and verify in staging environment