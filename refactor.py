import os
import re

def process_dir(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Pattern: 
                # mutationFn: async (args) => { body },
                # onSuccess: [async] () => { body2 }
                
                pattern = r"(mutationFn:\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?)\},\s*onSuccess:\s*(?:async\s*)?\(\)\s*=>\s*\{([\s\S]*?queryClient\.invalidateQueries[\s\S]*?)\}(,)?(\n|})?"
                
                def replacer(match):
                    mutation_fn_part = match.group(1) 
                    on_success_body = match.group(2)
                    comma = match.group(3) or ""
                    end = match.group(4) or ""
                    
                    return mutation_fn_part + "\n" + on_success_body + "}" + comma + end
                
                new_content, count = re.subn(pattern, replacer, content)
                
                if count > 0:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Refactored {count} mutation(s) in {filepath}")

process_dir('./client/src')
