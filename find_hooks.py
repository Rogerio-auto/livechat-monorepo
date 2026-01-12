import json

with open('lint_report.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for entry in data:
    for msg in entry['messages']:
        if msg.get('ruleId') == 'react-hooks/rules-of-hooks':
            print(f"File: {entry['filePath']} | Line: {msg['line']} | Message: {msg['message']}")
