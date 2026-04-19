# Learning Resource Soft Delete & Recycle Bin Implementation

This document describes the implementation of soft-delete functionality for learning resources and the addition of a recycle bin UI for non-technical users.

## Overview

**Date**: April 20, 2026  
**Feature**: Soft-delete for learning resources with visible restore UI in the resource library

### Key Changes

1. **Database Schema**: Added soft-delete fields to `learning_resources` table
2. **API**: Added `showDeleted` query parameter to filter deleted vs. active resources
3. **Service Layer**: Updated to handle soft-delete logic and filtering
4. **UI**: Added visible "Recycle Bin" button in the resource library to browse and restore deleted resources

---

## Installation & Setup

### 1. Apply the Database Migration

The soft-delete feature requires a manual database migration. Run one of these commands:

**Production Database:**
```bash
npm run db:sync:resources:soft-delete
```

**Test Database:**
```bash
npm run db:test:sync:resources:soft-delete
```

**Manual Application (if the npm script doesn't work):**
```powershell
Get-Content prisma/manual-migrations/20260420_learning_resources_soft_delete.sql | npx prisma db execute --stdin --schema prisma/schema.prisma
```

**Migration Contents:**
- Adds `deleted_at` column (TIMESTAMPTZ)
- Adds `deleted_by_user_id` column (UUID)
- Creates FK constraint to users table
- Creates index for efficient active resource queries

### 2. Regenerate Prisma Client

After the migration is applied, regenerate the Prisma client:

```bash
npm install
# or
npx prisma generate
```

### 3. Restart Development Server

```bash
npm run dev
```

---

## How to Use: Recycle Bin Feature

### For End Users

1. **Open the Resource Library**
   - Navigate to the course/batch resource management section
   - Look for the "Resource Library" card

2. **Delete a Resource**
   - Click the three-dot menu (⋯) on any resource
   - Select "Delete"
   - Confirm: "Move to Recycle Bin"
   - The resource is now soft-deleted but recoverable

3. **Restore Deleted Resources**
   - Click the "Recycle Bin" button in the library header
   - A modal will show all deleted resources
   - Search/filter as needed
   - Click the menu (⋯) on the deleted resource
   - Select "Restore"
   - Confirm the restoration
   - The resource returns to the active list

### Key Benefits

- **Data Recovery**: Deleted resources can be restored anytime
- **Audit Trail**: Delete information is logged (who deleted it, when)
- **Non-destructive**: Original resource data, assignments, and history are preserved
- **Compliance**: Soft-delete enables audit and compliance requirements

---

## Technical Details

### API Endpoints

**List Active Resources:**
```http
GET /api/learning-resources?page=1&pageSize=25
```

**List Deleted Resources:**
```http
GET /api/learning-resources?showDeleted=true&page=1&pageSize=25
```

**Restore a Deleted Resource:**
```http
POST /api/learning-resources/{resourceId}/restore-deleted
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `showDeleted` | boolean | false | When true, returns only soft-deleted resources |
| `page` | number | 1 | Pagination page |
| `pageSize` | number | 25 | Items per page |
| `search` | string | - | Search by title, description, or filename |
| `status` | string | - | Filter by status (DRAFT, PUBLISHED, ARCHIVED) |

### Validation Schema

The list query validation now accepts:
```typescript
{
  showDeleted: boolean | undefined
  // ... other filters
}
```

### Service Layer Functions

**List Resources (active or deleted):**
```typescript
listLearningResourcesService(filters: {
  showDeleted?: boolean  // false by default
  page?: number
  pageSize?: number
  // ... other filters
})
```

**Restore Deleted Resource:**
```typescript
restoreDeletedLearningResourceService(
  resourceId: string,
  options?: { actorUserId?: string }
)
```

**Delete (soft-delete):**
```typescript
deleteLearningResourceService(
  resourceId: string,
  options?: { actorUserId?: string }
)
```

### Data Model Changes

**LearningResourceListItem Type:**
```typescript
type LearningResourceListItem = {
  // ... existing fields
  deletedAt: string | null;  // NEW: ISO timestamp when deleted
  // ... rest of fields
}
```

### Database Schema Changes

```sql
ALTER TABLE learning_resources
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ(6);
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID;

ALTER TABLE learning_resources
  ADD CONSTRAINT learning_resources_deleted_by_user_id_fkey
  FOREIGN KEY (deleted_by_user_id)
  REFERENCES users(user_id)
  ON DELETE SET NULL;

CREATE INDEX idx_learning_resources_active_updated
  ON learning_resources(deleted_at, updated_at);
```

---

## File Structure

### New Files Created

```
components/modules/course-builder/
  ├── learning-resource-recycle-bin.tsx (NEW: Recycle bin modal UI)
  
scripts/
  ├── apply-migrations.mjs (NEW: Migration application helper)
  
prisma/manual-migrations/
  └── 20260420_learning_resources_soft_delete.sql (NEW: Migration SQL)
```

### Modified Files

```
lib/validation-schemas/learning-resources.ts
  ✓ Added showDeleted field to query schema

services/learning-resources/
  ├── queries.ts (Updated filtering logic)
  ├── types.ts (Added deletedAt field)
  └── commands.ts (Updated delete behavior)

components/modules/course-builder/learning-resource-library.tsx
  ✓ Integrated recycle bin button
  ✓ Added state management for modal

components/modules/course-builder/
  ├── learning-resource-client.ts (Added deletedAt field)
  
package.json
  ✓ Added db:sync:resources:soft-delete script
  ✓ Added db:test:sync:resources:soft-delete script
```

---

## Troubleshooting

### Issue: Migration fails with "EPERM" error

**Cause**: Node process still holding the Prisma engine file  
**Solution**:
```powershell
# Stop any running dev servers
# Then try the migration again:
npm run db:sync:resources:soft-delete
```

### Issue: TypeScript errors after migration

**Cause**: Prisma client cache is stale  
**Solution**:
```bash
npx prisma generate
npm run typecheck
```

### Issue: Recycle bin button not showing

**Cause**: User doesn't have `learning_resources.delete` permission  
**Solution**: Verify RBAC configuration includes delete permission for the user role

### Issue: Restore button greyed out

**Cause**: Permission not granted  
**Solution**: Ensure user has `learning_resources.delete` permission (same as delete permission)

---

## Rollback (if needed)

To revert the soft-delete feature:

```sql
-- Remove the migration (manual reversal)
ALTER TABLE learning_resources
  DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE learning_resources
  DROP COLUMN IF EXISTS deleted_by_user_id;
DROP INDEX IF EXISTS idx_learning_resources_active_updated;
```

**Note**: This is irreversible if data has already been soft-deleted. Ensure a backup exists before rollback.

---

## Testing

### Unit Tests (Coming Soon)

- Test soft-delete behavior
- Test restore functionality
- Test filtering active vs. deleted resources
- Test RBAC permissions

### Manual Testing Checklist

- [ ] Delete a resource → verify it disappears from active list
- [ ] Open Recycle Bin → verify deleted resource appears
- [ ] Search in Recycle Bin → verify search works
- [ ] Restore a resource → verify it returns to active list
- [ ] Verify audit logs record delete/restore actions
- [ ] Test pagination in recycle bin
- [ ] Test with different user roles

---

## Performance Notes

- **Active Resource Queries**: Optimized with index on `(deleted_at, updated_at)`
- **Deleted Resource Queries**: Fast filtering using `deletedAt IS NOT NULL`
- **Pagination**: Works same as active resources (25 items default)

---

## Security & Permissions

- **Delete Permission**: Only users with `learning_resources.delete` can soft-delete
- **Restore Permission**: Only users with `learning_resources.delete` can restore
- **Audit Logging**: All deletes/restores are logged with actor user ID
- **RBAC Integration**: Follows existing role-based access control

---

## Future Enhancements

- [ ] Permanent deletion after X days (configurable retention)
- [ ] Batch restore operations
- [ ] Recycle bin size limits
- [ ] Recycle bin export/import
- [ ] Admin dashboard for recycle bin analytics
- [ ] Automatic cleanup jobs
- [ ] Email notifications on restore

---

## References

- **Manual Migration**: `prisma/manual-migrations/20260420_learning_resources_soft_delete.sql`
- **Service Logic**: `services/learning-resources/` (commands.ts, queries.ts)
- **UI Component**: `components/modules/course-builder/learning-resource-recycle-bin.tsx`
- **API Route**: `app/api/learning-resources/[resourceId]/restore-deleted/route.ts`

---

**Last Updated**: April 20, 2026  
**Status**: ✅ Implementation Complete
