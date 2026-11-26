"""
Parse .xlsx files without third-party dependencies using Python's built-in zipfile and xml.etree.ElementTree.
Outputs a JSON 2D array: [ [cell, cell, ...], [cell, cell, ...] ]
"""
import sys
import json
import zipfile
import xml.etree.ElementTree as ET

def get_text_no_ns(element, tag_name):
    """Find child element matching tag_name ignoring XML namespace"""
    if element is None:
        return None
    for child in element.iter():
        # tag can be '{http://...}tag_name' or just 'tag_name'
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
        if tag == tag_name:
            return child.text
    return None

def col_ref_to_index(cell_ref):
    """Convert Excel cell reference like 'J2' or 'AA15' to 0-based column index."""
    if not cell_ref:
        return None
    col_idx = 0
    found_letter = False
    for ch in cell_ref:
        if 'A' <= ch <= 'Z':
            col_idx = col_idx * 26 + (ord(ch) - ord('A') + 1)
            found_letter = True
        elif 'a' <= ch <= 'z':
            col_idx = col_idx * 26 + (ord(ch) - ord('a') + 1)
            found_letter = True
        else:
            break
    return (col_idx - 1) if found_letter else None


def parse_xlsx(file_path):
    with zipfile.ZipFile(file_path, 'r') as z:
        # 1. Load shared strings if present
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for elem in root.iter():
                tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                if tag == 'si':
                    # collect all 't' texts under this 'si'
                    texts = []
                    for t_elem in elem.iter():
                        t_tag = t_elem.tag.split('}')[-1] if '}' in t_elem.tag else t_elem.tag
                        if t_tag == 't' and t_elem.text:
                            texts.append(t_elem.text)
                    shared_strings.append(''.join(texts))

        # 2. Find target worksheet (prefer "Positions" or first sheet)
        sheet_names = sorted(
            name for name in z.namelist()
            if name.startswith('xl/worksheets/sheet') and name.endswith('.xml')
        )
        if not sheet_names:
            return []
        
        target_sheet = sheet_names[0]
        root = ET.fromstring(z.read(target_sheet))

        rows_data = []

        for row in root.iter():
            row_tag = row.tag.split('}')[-1] if '}' in row.tag else row.tag
            if row_tag != 'row':
                continue

            row_cells = []
            for cell in row:
                cell_tag = cell.tag.split('}')[-1] if '}' in cell.tag else cell.tag
                if cell_tag != 'c':
                    continue

                cell_type = cell.attrib.get('t', '')
                raw_v = get_text_no_ns(cell, 'v')
                raw_t = get_text_no_ns(cell, 't')

                if cell_type == 's' and raw_v is not None:
                    try:
                        idx = int(raw_v)
                        val = shared_strings[idx] if idx < len(shared_strings) else raw_v
                    except (ValueError, IndexError):
                        val = raw_v
                elif cell_type == 'inlineStr' or raw_t is not None:
                    val = raw_t if raw_t is not None else (raw_v or '')
                else:
                    val = raw_v if raw_v is not None else (raw_t or '')

                col_idx = col_ref_to_index(cell.attrib.get('r', ''))
                if col_idx is not None:
                    while len(row_cells) < col_idx:
                        row_cells.append('')
                    if col_idx < len(row_cells):
                        row_cells[col_idx] = str(val).strip()
                    else:
                        row_cells.append(str(val).strip())
                else:
                    row_cells.append(str(val).strip())

            if any(row_cells):
                rows_data.append(row_cells)

        return rows_data

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(0)
    
    try:
        data = parse_xlsx(sys.argv[1])
        print(json.dumps(data, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
