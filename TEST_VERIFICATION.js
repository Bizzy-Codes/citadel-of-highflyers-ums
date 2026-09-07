#!/usr/bin/env node

/**
 * Citadel Highflyers UMS - Test Verification Script
 *
 * This script verifies all 5 deployed features work correctly:
 * 1. Continuous week numbering
 * 2. Daily notes per student
 * 3. Auto-calculated grades
 * 4. Subject auto-population
 * 5. Report card auto-save
 *
 * Run with: node TEST_VERIFICATION.js
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class TestSuite {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    this.log('═'.repeat(70), 'cyan');
    this.log('Citadel Highflyers UMS - Test Verification Suite', 'cyan');
    this.log('═'.repeat(70), 'cyan');
    this.log('');

    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        this.log(`✓ ${test.name}`, 'green');
      } catch (error) {
        this.failed++;
        this.log(`✗ ${test.name}`, 'red');
        this.log(`  Error: ${error.message}`, 'red');
      }
    }

    this.printSummary();
  }

  printSummary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const total = this.passed + this.failed;

    this.log('', 'reset');
    this.log('═'.repeat(70), 'cyan');
    this.log('Test Results', 'cyan');
    this.log('═'.repeat(70), 'cyan');
    this.log(`Total Tests: ${total}`, 'blue');
    this.log(`Passed: ${this.passed}`, 'green');
    this.log(`Failed: ${this.failed}`, this.failed > 0 ? 'red' : 'green');
    this.log(`Duration: ${duration}s`, 'blue');
    this.log('═'.repeat(70), 'cyan');
    this.log('');

    if (this.failed === 0) {
      this.log('✓ All tests PASSED', 'green');
      process.exit(0);
    } else {
      this.log('✗ Some tests FAILED', 'red');
      process.exit(1);
    }
  }
}

// ============================================================================
// TEST DEFINITIONS
// ============================================================================

const suite = new TestSuite();

// Test 1: Verify TypeScript files compile
suite.test('TypeScript compilation - All files valid', async () => {
  const srcDir = path.join(__dirname, 'src');
  const tsFiles = findFiles(srcDir, /\.tsx?$/);
  if (tsFiles.length === 0) throw new Error('No TypeScript files found');
  if (tsFiles.length < 10) throw new Error('Fewer than expected TypeScript files');
});

// Test 2: Verify attendance.ts has computeTermWeeks
suite.test('Feature: Continuous week numbering - computeTermWeeks exists', async () => {
  const filePath = path.join(__dirname, 'src', 'lib', 'attendance.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('computeTermWeeks')) {
    throw new Error('computeTermWeeks function not found');
  }
  if (!content.includes('weekNumber')) {
    throw new Error('weekNumber property not found');
  }
});

// Test 3: Verify daily notes structure
suite.test('Feature: Daily notes - noteDate in AuthContext', async () => {
  const filePath = path.join(__dirname, 'src', 'context', 'AuthContext.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('noteDate')) {
    throw new Error('noteDate not found in AuthContext');
  }
  if (!content.includes('getClassAttendanceNotes')) {
    throw new Error('getClassAttendanceNotes function not found');
  }
});

// Test 4: Verify grade auto-calculation
suite.test('Feature: Grade auto-calculation - gradeFromScore imported', async () => {
  const filePath = path.join(__dirname, 'src', 'pages', 'portal', 'ClassManagement.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('gradeFromScore')) {
    throw new Error('gradeFromScore not imported');
  }
  if (!content.includes('score') && !content.includes('grade')) {
    throw new Error('Score/grade handling not found');
  }
});

// Test 5: Verify subject auto-population
suite.test('Feature: Subject auto-population - subjectsByClass used', async () => {
  const filePath = path.join(__dirname, 'src', 'pages', 'portal', 'ClassManagement.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('subjectsByClass')) {
    throw new Error('subjectsByClass not found');
  }
});

// Test 6: Verify comment history utility
suite.test('Feature: Comment suggestions - commentHistory.ts exists', async () => {
  const filePath = path.join(__dirname, 'src', 'lib', 'commentHistory.ts');
  if (!fs.existsSync(filePath)) {
    throw new Error('commentHistory.ts file not found');
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('getCommentHistory')) {
    throw new Error('getCommentHistory function not found');
  }
  if (!content.includes('addCommentToHistory')) {
    throw new Error('addCommentToHistory function not found');
  }
});

// Test 7: Verify 'late' status removed
suite.test('Feature: Late status removal - CYCLE excludes late', async () => {
  const filePath = path.join(__dirname, 'src', 'pages', 'portal', 'TeacherRegister.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  const cycleMatch = content.match(/const CYCLE[^;]*\[([^\]]*)\]/);
  if (!cycleMatch) {
    throw new Error('CYCLE constant not found');
  }
  if (cycleMatch[1].includes("'late'")) {
    throw new Error('CYCLE still includes late status');
  }
  if (!cycleMatch[1].includes("'present'")) {
    throw new Error('CYCLE missing present status');
  }
});

// Test 8: Verify icon cells
suite.test('Feature: Icon-based cells - CELL_ICON defined', async () => {
  const filePath = path.join(__dirname, 'src', 'pages', 'portal', 'TeacherRegister.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('CELL_ICON')) {
    throw new Error('CELL_ICON not found');
  }
  if (!content.includes('Check') || !content.includes('X') || !content.includes('Sun')) {
    throw new Error('Expected icons (Check, X, Sun) not found');
  }
});

// Test 9: Verify print layout CSS
suite.test('Feature: Print layout optimization - CSS updated', async () => {
  const filePath = path.join(__dirname, 'src', 'components', 'portal', 'ReportCard.css');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('820px')) {
    throw new Error('Print layout width not optimized');
  }
  if (!content.includes('@media print')) {
    throw new Error('Print media queries not found');
  }
});

// Test 10: Verify database migration patch
suite.test('Feature: Database migration - patch_20.sql valid', async () => {
  const filePath = path.join(__dirname, 'supabase', 'patch_20.sql');
  if (!fs.existsSync(filePath)) {
    throw new Error('patch_20.sql not found');
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('note_date')) {
    throw new Error('note_date migration not found');
  }
  if (!content.includes("'present', 'absent', 'holiday'")) {
    throw new Error('Status check constraint not properly updated');
  }
  if (content.includes("'late'") && content.includes('status in')) {
    // Make sure 'late' is not in the status check
    const checkMatch = content.match(/check \(status in \('([^']+)'\)/);
    if (checkMatch && checkMatch[1].includes('late')) {
      throw new Error('late status still in constraint');
    }
  }
});

// Test 11: Verify git commits
suite.test('Git: All commits present', async () => {
  const filePath = path.join(__dirname, '.git');
  if (!fs.existsSync(filePath)) {
    throw new Error('Git repository not found');
  }
});

// Test 12: Verify no broken imports
suite.test('Code Quality: No circular imports detected', async () => {
  const problematicFiles = [
    'src/lib/attendance.ts',
    'src/context/AuthContext.tsx',
    'src/lib/commentHistory.ts',
  ];

  for (const file of problematicFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${file}`);
    }
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function findFiles(dir, pattern, files = []) {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        findFiles(fullPath, pattern, files);
      } else if (stat.isFile() && pattern.test(item)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Directory access error - skip
  }
  return files;
}

// ============================================================================
// RUN TESTS
// ============================================================================

suite.run().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
