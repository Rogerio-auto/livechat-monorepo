import json
import os
from collections import Counter

report_path = 'lint_report.json'

if not os.path.exists(report_path):
    print(f"File {report_path} not found.")
else:
    with open(report_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    total_errors = 0
    total_warnings = 0
    violations = Counter()
    folder_errors = Counter()
    
    for entry in data:
        file_path = entry['filePath']
        folder = 'other'
        if 'backend' in file_path:
            folder = 'backend'
        elif 'frontend' in file_path:
            folder = 'frontend'
        elif 'cadastro' in file_path:
            folder = 'cadastro'
            
        for msg in entry['messages']:
            rule_id = msg.get('ruleId', 'unknown')
            severity = msg.get('severity', 0)
            
            violations[rule_id] += 1
            if severity == 2:
                total_errors += 1
                folder_errors[folder] += 1
            elif severity == 1:
                total_warnings += 1

    print(f"📊 Summary:")
    print(f"Total Errors: {total_errors}")
    print(f"Total Warnings: {total_warnings}")
    print("\n📊 Errors by Folder:")
    for folder, count in folder_errors.items():
        print(f"{folder}: {count}")
        
    print("\n📋 Top 10 Violations:")
    for rule, count in violations.most_common(10):
        print(f"{rule}: {count}")
