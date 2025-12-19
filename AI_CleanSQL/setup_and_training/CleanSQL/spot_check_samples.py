"""Spot check generated training samples to validate quality."""
import json
import re
from pathlib import Path
from typing import List, Dict, Tuple


def parse_response(content: str) -> Tuple[List[str], str, str, List[str]]:
    """Parse assistant response into components."""
    # Extract PLAN
    plan_match = re.search(r'PLAN:\s*(.*?)(?=BASIC_SQL:)', content, re.DOTALL)
    plan = []
    if plan_match:
        plan_lines = [l.strip() for l in plan_match.group(1).strip().split('\n') if l.strip() and (l.strip().startswith('-') or l.strip().startswith('*'))]
        plan = [re.sub(r'^[-*]\s*', '', l).strip() for l in plan_lines]
    
    # Extract BASIC_SQL
    basic_match = re.search(r'BASIC_SQL:\s*```sql\s*(.*?)```', content, re.DOTALL)
    basic_sql = basic_match.group(1).strip() if basic_match else ""
    
    # Extract ROBUST_SQL
    robust_match = re.search(r'ROBUST_SQL:\s*```sql\s*(.*?)```', content, re.DOTALL)
    robust_sql = robust_match.group(1).strip() if robust_match else ""
    
    # Extract NOTES
    notes_match = re.search(r'NOTES:\s*(.*?)(?=\n\n|\Z)', content, re.DOTALL)
    notes = []
    if notes_match:
        notes_text = notes_match.group(1).strip()
        if notes_text.lower() != "no quality-repairs required.":
            note_lines = [l.strip() for l in notes_text.split('\n') if l.strip()]
            for line in note_lines:
                cleaned = re.sub(r'^\d+\.\s*', '', line)
                if cleaned:
                    notes.append(cleaned)
    
    return plan, basic_sql, robust_sql, notes


def validate_notes_format(notes: List[str]) -> Tuple[bool, List[str]]:
    """Validate NOTES format matches requirements.
    
    Requirements:
    1. Each note should mention column name
    2. Each note should have count and percentage: "X values (Y%)"
    3. Each note should mention the repair action (imputed, deduplicated, capped)
    4. Format: "ColumnName column had X missing values (Y%), which had to be imputed with median."
    """
    errors = []
    
    for i, note in enumerate(notes, 1):
        # Check for column/table name
        if not re.search(r'\b(column|table)\b', note, re.IGNORECASE):
            errors.append(f"Note {i}: Missing 'column' or 'table' keyword")
        
        # Check for count and percentage pattern: "X values (Y%)" or "X missing values (Y%)"
        count_pct_pattern = r'\d+[,\d]*\s+(?:missing|duplicate|outlier)?\s*(?:values?|rows?)\s*\([0-9.]+%\)'
        if not re.search(count_pct_pattern, note, re.IGNORECASE):
            # Try alternative: "X (Y%)"
            alt_pattern = r'\d+[,\d]*\s*\([0-9.]+%\)'
            if not re.search(alt_pattern, note):
                errors.append(f"Note {i}: Missing count and percentage format (e.g., '2,143 missing values (3.4%)')")
        
        # Check for repair action
        action_keywords = ['imputed', 'deduplicated', 'capped', 'dropped', 'repaired']
        if not any(keyword in note.lower() for keyword in action_keywords):
            errors.append(f"Note {i}: Missing repair action (imputed/deduplicated/capped)")
        
        # Check for imputation method (if imputed)
        if 'imputed' in note.lower():
            method_keywords = ['median', 'mode', 'mean', 'average']
            if not any(keyword in note.lower() for keyword in method_keywords):
                errors.append(f"Note {i}: Missing imputation method (median/mode/mean)")
    
    return len(errors) == 0, errors


def check_sample(example: Dict, idx: int) -> Tuple[bool, Dict]:
    """Check a single sample."""
    issues = {
        "missing_sections": [],
        "notes_format_errors": [],
        "sql_issues": [],
        "structure_issues": [],
    }
    
    messages = example.get("messages", [])
    if len(messages) != 3:
        issues["structure_issues"].append(f"Expected 3 messages, got {len(messages)}")
        return False, issues
    
    assistant_content = messages[2].get("content", "")
    if not assistant_content:
        issues["missing_sections"].append("Empty assistant content")
        return False, issues
    
    plan, basic_sql, robust_sql, notes = parse_response(assistant_content)
    
    # Check structure
    if not plan:
        issues["missing_sections"].append("PLAN")
    if not basic_sql:
        issues["missing_sections"].append("BASIC_SQL")
    if not robust_sql:
        issues["missing_sections"].append("ROBUST_SQL")
    
    # Check NOTES format
    if notes:
        is_valid, errors = validate_notes_format(notes)
        if not is_valid:
            issues["notes_format_errors"] = errors
    
    # Check SQL syntax (basic)
    if basic_sql and not basic_sql.strip().upper().startswith('SELECT'):
        issues["sql_issues"].append("BASIC_SQL doesn't start with SELECT")
    if robust_sql and not robust_sql.strip().upper().startswith(('SELECT', 'WITH')):
        issues["sql_issues"].append("ROBUST_SQL doesn't start with SELECT or WITH")
    
    # Check if ROBUST_SQL has CTEs (should have for repairs)
    if robust_sql and 'WITH' not in robust_sql.upper() and notes:
        issues["sql_issues"].append("ROBUST_SQL should use CTEs for repairs but doesn't contain WITH")
    
    is_valid = (
        len(issues["missing_sections"]) == 0 and
        len(issues["notes_format_errors"]) == 0 and
        len(issues["sql_issues"]) == 0
    )
    
    return is_valid, issues


def spot_check(file_path: Path, num_samples: int = 10) -> None:
    """Spot check training samples."""
    print("=" * 70)
    print("SPOT CHECK: Training Data Quality")
    print("=" * 70)
    
    examples = []
    with file_path.open() as f:
        for line in f:
            if line.strip():
                examples.append(json.loads(line))
    
    print(f"\nTotal samples: {len(examples)}")
    print(f"Checking first {num_samples} samples...\n")
    
    valid_count = 0
    invalid_count = 0
    
    for i in range(min(num_samples, len(examples))):
        example = examples[i]
        is_valid, issues = check_sample(example, i)
        
        if is_valid:
            valid_count += 1
            print(f"✓ Sample {i+1}: VALID")
        else:
            invalid_count += 1
            print(f"✗ Sample {i+1}: INVALID")
            if issues["missing_sections"]:
                print(f"  Missing sections: {', '.join(issues['missing_sections'])}")
            if issues["notes_format_errors"]:
                print(f"  Notes format errors:")
                for err in issues["notes_format_errors"][:3]:  # Show first 3
                    print(f"    - {err}")
            if issues["sql_issues"]:
                print(f"  SQL issues: {', '.join(issues['sql_issues'])}")
        
        # Show sample details
        messages = example.get("messages", [])
        if len(messages) >= 3:
            assistant_content = messages[2].get("content", "")
            plan, basic_sql, robust_sql, notes = parse_response(assistant_content)
            
            print(f"  PLAN steps: {len(plan)}")
            print(f"  BASIC_SQL length: {len(basic_sql)} chars")
            print(f"  ROBUST_SQL length: {len(robust_sql)} chars")
            print(f"  NOTES count: {len(notes)}")
            if notes:
                print(f"  NOTES preview: {notes[0][:80]}...")
            print()
    
    print("=" * 70)
    print(f"Summary: {valid_count} valid, {invalid_count} invalid out of {num_samples} checked")
    print("=" * 70)
    
    if invalid_count > 0:
        print("\n⚠ Some samples failed validation. Review and regenerate if needed.")
    else:
        print("\n✓ All checked samples are valid!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Spot check training samples")
    parser.add_argument("file", type=Path, help="Training data JSONL file")
    parser.add_argument("--num-samples", type=int, default=10, help="Number of samples to check")
    args = parser.parse_args()
    
    spot_check(args.file, args.num_samples)

