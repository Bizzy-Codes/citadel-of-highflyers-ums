# Rollback Procedures - Deployment Recovery Guide

**Critical**: These procedures should only be used if deployment fails. Follow them exactly.

---

## 🚨 Quick Decision Tree

```
Issue During Deployment?
├─ Database migration failed?
│  └─ → ROLLBACK DATABASE (Step 1)
├─ Code push failed?
│  └─ → ROLLBACK CODE (Step 2)
├─ Tests failed after deployment?
│  └─ → INVESTIGATE FIRST (Step 3)
└─ Partial failure?
   └─ → ROLLBACK ALL (Full Sequence)
```

---

## STEP 1: Rollback Database Migration

### If Migration Failed During Execution

**Status**: Database changes partially applied

**Recovery**:

```bash
# Option A: Restore from backup (SAFEST)
psql $SUPABASE_DB_URL < attendance_notes_backup.sql
psql $SUPABASE_DB_URL < attendance_records_backup.sql
```

**Verification**:
```bash
# Verify old schema still exists
psql $SUPABASE_DB_URL -c "
  SELECT column_name FROM information_schema.columns 
  WHERE table_name='attendance_notes' AND column_name='week_start';
"
# Should return: week_start
```

### If Migration Succeeded But Causes Problems

**Status**: Database migrated but code/app has issues

**Recovery**: Create rollback SQL

```sql
-- ROLLBACK PATCH 20
-- This reverses all changes from patch_20.sql

-- Step 1: Recreate week_start column from note_date
ALTER TABLE public.attendance_notes ADD COLUMN IF NOT EXISTS week_start DATE;
UPDATE public.attendance_notes SET week_start = note_date WHERE week_start IS NULL;
ALTER TABLE public.attendance_notes ALTER COLUMN week_start SET NOT NULL;

-- Step 2: Restore old unique constraint
ALTER TABLE public.attendance_notes DROP CONSTRAINT IF EXISTS attendance_notes_student_id_note_date_key;
ALTER TABLE public.attendance_notes ADD UNIQUE (student_id, week_start);

-- Step 3: Restore old index
DROP INDEX IF EXISTS attendance_notes_class_date_idx;
CREATE INDEX IF NOT EXISTS attendance_notes_class_week_idx ON public.attendance_notes (class_name, week_start);

-- Step 4: Drop new note_date column
ALTER TABLE public.attendance_notes DROP COLUMN IF EXISTS note_date;

-- Step 5: Restore old status constraint
ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_status_check;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_status_check
  CHECK (status IN ('present', 'absent', 'late', 'holiday'));

-- Step 6: Restore old RLS policies (keep the same, they don't reference changed columns)
-- Policies are already compatible, no action needed

-- Confirm rollback
SELECT column_name FROM information_schema.columns 
WHERE table_name='attendance_notes' AND column_name='week_start';
```

**Execute rollback**:
```bash
cat > rollback_db.sql << 'EOF'
-- [Paste SQL from above]
EOF

psql $SUPABASE_DB_URL -f rollback_db.sql
```

**Verification**:
```bash
# Check old schema exists
psql $SUPABASE_DB_URL -c "
  SELECT column_name FROM information_schema.columns 
  WHERE table_name='attendance_notes';
" | grep week_start

# Check status constraint
psql $SUPABASE_DB_URL -c "
  SELECT constraint_def FROM pg_constraints 
  WHERE table_name='attendance_records' AND constraint_name='attendance_records_status_check';
" | grep -c "late"  # Should return 1 (late is back)
```

---

## STEP 2: Rollback Code Deployment

### If Git Push Failed

**Status**: Code changes not pushed to remote

**Recovery**:
```bash
# No action needed - changes are still local
git log --oneline -6  # Verify commits are still local

# If you want to undo commits locally:
git reset --soft HEAD~6  # Keep changes, undo commits
git reset --hard HEAD~6  # Discard changes completely (USE WITH CAUTION)
```

### If Git Push Succeeded But Code Is Broken

**Status**: Broken code is now on remote

**Recovery** (requires git access):
```bash
# Option A: Revert the deployment commits
git revert 2292728..ddb0ad9 --no-edit
git push origin sync-from-main

# This creates new "revert" commits that undo the changes

# Option B: Force reset to previous commit (DESTRUCTIVE)
git reset --hard 5c696c2  # Reset to before deployment
git push --force-with-lease origin sync-from-main

# CAUTION: This will lose all commits since 5c696c2
```

**Verification**:
```bash
git log --oneline -3  # Should show revert commits or reset
git status            # Should show "Your branch is up to date"
```

---

## STEP 3: Investigate Deployment Issues

### If Deployment Succeeded But Tests Fail

**Status**: All changes applied, but something is broken

**Debugging**:

```bash
# Check application logs
tail -f /var/log/app.log

# Check database logs
psql $SUPABASE_DB_URL -c "
  SELECT * FROM pg_stat_statements 
  WHERE query LIKE '%attendance%' 
  ORDER BY mean_time DESC LIMIT 5;
"

# Verify app can connect to database
npm run test:db

# Check TypeScript compilation
npm run build:ssr

# Run full test suite
npm run test
```

### Common Issues and Solutions

**Issue**: "Column note_date does not exist"
```
Cause: Migration didn't run or failed silently
Fix: Re-run database migration with error checking
psql $SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/patch_20.sql
```

**Issue**: "Status value 'late' not allowed"
```
Cause: Code trying to save 'late' status
Fix: Restart app after database migration
npm run dev  # Restart dev server
```

**Issue**: "Constraint attendance_notes_student_id_note_date_key already exists"
```
Cause: Migration ran twice
Fix: Manually drop constraint
psql $SUPABASE_DB_URL -c "
  ALTER TABLE public.attendance_notes 
  DROP CONSTRAINT IF EXISTS attendance_notes_student_id_note_date_key;
"
```

---

## STEP 4: Full Deployment Rollback

### If Everything Needs to Be Reverted

**Order of Operations** (IMPORTANT):

1. **Rollback Code First** (prevents new requests using old schema)
```bash
git revert 2292728..ddb0ad9 --no-edit
git push origin sync-from-main
# Wait for app to restart/reload with old code
sleep 30
```

2. **Then Rollback Database**
```bash
psql $SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f rollback_db.sql
```

3. **Verify Both Rollbacks**
```bash
# Check code
git log --oneline -1  # Should show revert commit

# Check database
psql $SUPABASE_DB_URL -c "
  SELECT column_name FROM information_schema.columns 
  WHERE table_name='attendance_notes';
" | grep week_start  # Should exist

psql $SUPABASE_DB_URL -c "
  SELECT 1 FROM information_schema.constraint_column_usage 
  WHERE table_name='attendance_records' AND constraint_name LIKE '%late%';
"  # Should return 1 (late constraint exists)
```

---

## Disaster Recovery Checklist

- [ ] **Backup Taken**: Before any rollback, ensure backups exist
  ```bash
  pg_dump -t attendance_notes > backup_before_rollback.sql
  git log --oneline -10 > git_log_before_rollback.txt
  ```

- [ ] **Code Rollback Complete**: New code is reverted
  ```bash
  git status  # Shows "Your branch is up to date"
  ```

- [ ] **Database Rollback Complete**: Schema is restored
  ```bash
  psql $SUPABASE_DB_URL -c "SELECT 1"  # Connection works
  ```

- [ ] **App Restarted**: Fresh application startup
  ```bash
  npm run dev  # Or your deployment restart command
  ```

- [ ] **Tests Passing**: Verify rollback success
  ```bash
  node TEST_VERIFICATION.js  # Run verification suite
  ```

- [ ] **Monitoring Active**: Watch for errors
  ```bash
  tail -f /var/log/app.log
  ```

---

## Post-Rollback Analysis

After a successful rollback, perform root cause analysis:

1. **Review Deployment Logs**
   ```bash
   cat deployment.log | grep -i error
   ```

2. **Check Test Results**
   ```bash
   cat TEST_VERIFICATION.js.log
   ```

3. **Verify Backups**
   ```bash
   ls -lah .deployment_backup/
   ```

4. **Create Issue Report**
   - Document what failed
   - Include error messages
   - Note exact step that failed
   - Plan fix before retry

---

## Prevention: Pre-Rollback Safety

### Before Deployment

```bash
# 1. Backup everything
pg_dump > pre_deployment_backup.sql
git log --oneline -10 > pre_deployment_commits.txt

# 2. Test in staging
npm run test
npm run build:ssr

# 3. Verify database connection
psql $SUPABASE_DB_URL -c "SELECT 1"

# 4. Check git status
git status  # Must be clean
```

### During Deployment

```bash
# 1. Use deployment script with checkspoints
bash DEPLOY.sh

# 2. Monitor logs in separate terminal
tail -f deployment.log

# 3. Don't interrupt scripts
# Let each step complete fully
```

### After Deployment

```bash
# 1. Run verification tests
node TEST_VERIFICATION.js

# 2. Monitor application
tail -f /var/log/app.log

# 3. Test user workflows
# - Login as teacher
# - Add result
# - Check grades
# - View report card
```

---

## Emergency Contacts & Resources

- **Database Issues**: Check Supabase dashboard
- **Git Issues**: Review git documentation
- **Application Issues**: Check application logs
- **Rollback Verification**: Run TEST_VERIFICATION.js

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-09-07 | Initial rollback procedures |

---

**Last Updated**: 2026-09-07  
**Status**: ACTIVE  
**Maintenance**: Review after each deployment
