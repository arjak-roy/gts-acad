# Quick Reference: Soft-Delete Migration Commands

## Apply Migration

### Production Database
```bash
npm run db:sync:resources:soft-delete
```

### Test Database
```bash
npm run db:test:sync:resources:soft-delete
```

### Manual Application (Windows PowerShell)
```powershell
Get-Content prisma/manual-migrations/20260420_learning_resources_soft_delete.sql | npx prisma db execute --stdin --schema prisma/schema.prisma
```

## After Migration Applied

1. **Regenerate Prisma Client** (if not automatic)
   ```bash
   npx prisma generate
   ```

2. **Restart Dev Server**
   ```bash
   npm run dev
   ```

3. **Verify TypeScript**
   ```bash
   npm run typecheck
   ```

## Testing the Feature

1. Start the dev server
2. Go to any course's Resource Library
3. Look for the "♻️ Recycle Bin" button (top-right of library header)
4. Click to open the recycle bin modal
5. Delete a resource and verify it appears in recycle bin
6. Restore it and verify it returns to active list

## Troubleshooting

### Command not found: npm
- Ensure Node.js is installed
- Run from the correct directory (where package.json is located)

### Migration fails
- Stop any running dev servers
- Ensure DATABASE_URL or TEST_DATABASE_URL is set
- Check database connectivity
- Try the manual PowerShell version above

### Recycle bin button not showing
- Verify user has `learning_resources.delete` permission
- Check RBAC configuration in database
- Restart dev server after migration

### Can't restore deleted resource
- Same permission requirement as delete (`learning_resources.delete`)
- Check user's role assignments

## Documentation

- **Full Guide**: See `LEARNING_RESOURCE_SOFT_DELETE.md`
- **Implementation Summary**: See `IMPLEMENTATION_SUMMARY.md`
- **TypeScript Types**: Check `services/learning-resources/types.ts`
- **UI Component**: Check `components/modules/course-builder/learning-resource-recycle-bin.tsx`

## What Changed

### Database
- Added `deleted_at` and `deleted_by_user_id` columns
- Added index for performance

### API
- List endpoint now accepts `?showDeleted=true` parameter
- New restore endpoint

### UI
- Recycle bin button in resource library header
- Modal to browse and restore deleted resources

### Code
- Service layer updated to handle soft-delete
- Type definitions extended with `deletedAt` field
- Validation schema includes `showDeleted` parameter

## Performance

- Active resource queries remain optimized (same speed as before)
- Deleted resource queries use indexed column
- Pagination works the same for both

## Security

- Only users with `learning_resources.delete` permission can use recycle bin
- All delete/restore actions are audited
- No breaking changes to existing functionality

---

**Ready to deploy!** ✅
