"""
Production PDF Question Extraction Engine for SSC CGL Ingestion Pipeline
Featuring Spatial Bounding-Box Layout Parsing, Multi-Column Column Splitting,
PyMuPDF Native Table Extraction, Global 1-100 TCS Question Indexing, and TCS Green Highlight Matching.
"""
import os
import re
import fitz
import json
import uuid
from typing import Dict, List, Any, Optional, Tuple

# Expanded TCS Green Palette for Official Answer Detection
GREEN_COLORS = {
    3648575, 0x37ac3f, 0x008000, 0x2e7d32, 0x4caf50,
    0x006400, 0x32cd32, 0x1b5e20, 0x228b22, 0x00aa00
}

def is_green_color(color_int: int) -> bool:
    """Returns True if the integer font/fill color matches any TCS green highlight variation."""
    if color_int in GREEN_COLORS:
        return True
    r = (color_int >> 16) & 0xFF
    g = (color_int >> 8) & 0xFF
    b = color_int & 0xFF
    return (g > 100 and g > r + 30 and g > b + 30)

def normalize_math_to_latex(text: str) -> str:
    """Normalizes raw mathematical expressions into KaTeX/LaTeX format safely."""
    if not text:
        return ""
    if "$" in text:
        return text

    res = text
    res = re.sub(r'\bsqrt\(([^)]+)\)', lambda m: f"\\sqrt{{{m.group(1)}}}", res, flags=re.IGNORECASE)
    res = re.sub(r'°|\bdeg(ree)?s?\b', lambda m: r"^\circ", res, flags=re.IGNORECASE)
    res = re.sub(r'\btheta\b', lambda m: r"\theta", res, flags=re.IGNORECASE)
    res = re.sub(r'\balpha\b', lambda m: r"\alpha", res, flags=re.IGNORECASE)
    res = re.sub(r'\bbeta\b', lambda m: r"\beta", res, flags=re.IGNORECASE)
    res = re.sub(r'(\b[a-zA-Z0-9]+\b)/(\b[a-zA-Z0-9]+\b)', lambda m: f"\\frac{{{m.group(1)}}}{{{m.group(2)}}}", res)
    return res

def parse_inline_options(option_block_text: str) -> Dict[str, Optional[str]]:
    """Parses horizontal or vertical option strings into Option A, B, C, D."""
    options = {"A": None, "B": None, "C": None, "D": None}
    if not option_block_text:
        return options

    pattern = r'(?:^|\s+)(?:\(([a-d1-4])\)|([a-d1-4])\)|([1-4])\.)\s*'
    parts = re.split(pattern, option_block_text, flags=re.IGNORECASE)

    key_map = {"1": "A", "2": "B", "3": "C", "4": "D", "a": "A", "b": "B", "c": "C", "d": "D"}
    
    current_key = None
    buffer = []

    for token in parts:
        if not token:
            continue
        token_strip = token.strip().lower()
        if token_strip in key_map:
            if current_key and buffer:
                options[current_key] = normalize_math_to_latex(" ".join(buffer).strip())
                buffer = []
            current_key = key_map[token_strip]
        else:
            if current_key:
                buffer.append(token.strip())

    if current_key and buffer:
        options[current_key] = normalize_math_to_latex(" ".join(buffer).strip())

    return options

def extract_tables_from_fitz_page(page: fitz.Page) -> Optional[str]:
    """Uses PyMuPDF fast table finder to convert tables to Markdown format."""
    try:
        page_text = page.get_text()
        if not page_text or len(page_text) < 20:
            return None

        text_lower = page_text.lower()
        if not any(k in text_lower for k in ['table', '|', 'row', 'column', 'statement', 'match list', 'list i']):
            return None

        tabs = page.find_tables(strategy="lines")
        if tabs and tabs.tables:
            md_tables = []
            for tab in tabs.tables:
                table_matrix = tab.extract()
                if not table_matrix or len(table_matrix) < 2:
                    continue
                first_cell = str(table_matrix[0][0] or '')
                if "Section :" in first_cell or "Exam Date" in first_cell or "Roll Number" in first_cell:
                    continue
                
                headers = [str(c or '').strip().replace('\n', ' ') for c in table_matrix[0]]
                header_line = "| " + " | ".join(headers) + " |"
                sep_line = "| " + " | ".join(["---"] * len(headers)) + " |"
                
                data_lines = []
                for row in table_matrix[1:]:
                    cells = [str(c or '').strip().replace('\n', ' ') for c in row]
                    data_lines.append("| " + " | ".join(cells) + " |")
                
                md_tables.append(header_line + "\n" + sep_line + "\n" + "\n".join(data_lines))
            if md_tables:
                return "\n\n" + "\n\n".join(md_tables) + "\n\n"
    except Exception:
        pass
    return None

def extract_images_from_page(page: fitz.Page, pdf_name: str, page_num: int, q_num: int, img_out_dir: str) -> Optional[str]:
    """Extracts inline image from PDF page if present and returns saved relative image path."""
    try:
        images = page.get_images()
        if not images:
            return None
        
        os.makedirs(img_out_dir, exist_ok=True)
        for idx, img_info in enumerate(images):
            xref = img_info[0]
            base_image = page.parent.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]

            if base_image["width"] > 30 and base_image["height"] > 30:
                clean_pdf_basename = os.path.basename(pdf_name).replace('.pdf', '')
                safe_slug = re.sub(r'[^a-zA-Z0-9]', '_', clean_pdf_basename)[:30]
                img_name = f"{safe_slug}_p{page_num}_q{q_num}_{idx}.{image_ext}"
                img_path = os.path.join(img_out_dir, img_name)
                
                with open(img_path, "wb") as f:
                    f.write(image_bytes)
                return f"/question-images/{img_name}"
    except Exception:
        pass
    return None

def get_layout_sorted_blocks(page: fitz.Page) -> List[Tuple[float, float, float, float, str]]:
    """
    Detects page geometry and splits multi-column pages into left and right spatial columns.
    Returns blocks sorted in strict reading order (Left column top-to-bottom, then Right column).
    """
    rect = page.rect
    width = rect.width
    mid_x = width / 2.0

    raw_blocks = page.get_text("blocks")
    
    left_column = []
    right_column = []
    spanning = []

    for b in raw_blocks:
        x0, y0, x1, y1, text, b_num, b_type = b
        text_clean = text.strip()
        if not text_clean:
            continue

        if x1 <= mid_x + 20:
            left_column.append((x0, y0, x1, y1, text_clean))
        elif x0 >= mid_x - 20:
            right_column.append((x0, y0, x1, y1, text_clean))
        else:
            spanning.append((x0, y0, x1, y1, text_clean))

    if len(left_column) >= 2 and len(right_column) >= 2:
        left_column.sort(key=lambda b: b[1])
        right_column.sort(key=lambda b: b[1])
        return left_column + right_column
    else:
        all_b = left_column + right_column + spanning
        all_b.sort(key=lambda b: (b[1], b[0]))
        return all_b

def extract_tcs_questions(doc: fitz.Document, metadata: Dict[str, Any], img_out_dir: str) -> List[Dict[str, Any]]:
    """Extracts questions, options, and official correct answers from TCS iON response PDFs."""
    questions = []
    current_subject = "Quantitative Aptitude"
    pdf_filename = metadata["filename"]
    paper_name = metadata["paper_name"]
    year = metadata["year"]
    shift = metadata["shift"]

    all_spans = []
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        blocks = page.get_text("dict")["blocks"]
        for b in blocks:
            if "lines" in b:
                for line in b["lines"]:
                    for span in line["spans"]:
                        txt = span["text"].strip()
                        if txt:
                            all_spans.append({
                                "text": txt,
                                "color": span["color"],
                                "page": page_idx + 1
                            })

    i = 0
    q_counter = 1
    while i < len(all_spans):
        span = all_spans[i]
        txt = span["text"]

        if re.search(r'Section\s*:\s*Module\s*I\s*Mathematical', txt, re.I) or "Quantitative Aptitude" in txt:
            current_subject = "Quantitative Aptitude"
        elif re.search(r'Section\s*:\s*General Intelligence|Reasoning', txt, re.I):
            current_subject = "General Intelligence & Reasoning"
        elif re.search(r'Section\s*:\s*English Comprehension', txt, re.I):
            current_subject = "English Comprehension"
        elif re.search(r'Section\s*:\s*General Awareness|GK', txt, re.I):
            current_subject = "General Awareness"

        # Strictly match Q.1 or Q. 1 or Question 1 (Never Question ID :)
        q_match = re.match(r'^(?:Q\s*\.?\s*(\d+)|Question\s*(?:No\.?|Num\.?)\s*(\d+))', txt, re.I)
        if q_match:
            q_text_parts = []
            options = {"A": None, "B": None, "C": None, "D": None}
            correct_answer = None
            page_num = span["page"]

            q_image = extract_images_from_page(doc[page_num - 1], pdf_filename, page_num, q_counter, img_out_dir)

            i += 1
            while i < len(all_spans):
                curr = all_spans[i]
                curr_txt = curr["text"]

                if curr_txt == "Ans" or re.match(r'^[1-4]\.', curr_txt) or "Question ID :" in curr_txt:
                    break
                if not re.search(r'Status\s*:|Chosen Option\s*:|Option \d ID', curr_txt, re.I):
                    q_text_parts.append(curr_txt)
                i += 1

            if i < len(all_spans) and all_spans[i]["text"] == "Ans":
                i += 1

            opt_keys = ["A", "B", "C", "D"]
            opt_idx = 0
            while i < len(all_spans) and opt_idx < 4:
                curr = all_spans[i]
                curr_txt = curr["text"]
                curr_color = curr["color"]

                opt_match = re.match(r'^([1-4])\.\s*(.*)', curr_txt)
                if opt_match:
                    opt_num = int(opt_match.group(1))
                    opt_val = opt_match.group(2).strip()
                    k = opt_keys[opt_num - 1]
                    options[k] = normalize_math_to_latex(opt_val) if opt_val else f"Option {k}"

                    if is_green_color(curr_color):
                        correct_answer = k
                    opt_idx += 1

                i += 1
                if "Question ID :" in curr_txt or "Status :" in curr_txt:
                    break

            while i < len(all_spans):
                nxt_txt = all_spans[i]["text"]
                if re.match(r'^(?:Q\s*\.?\s*\d+)', nxt_txt, re.I) or "Section :" in nxt_txt:
                    break
                i += 1

            q_full_text = normalize_math_to_latex(" ".join(q_text_parts).strip())
            
            if q_full_text and (options["A"] or options["B"]):
                questions.append({
                    "id": str(uuid.uuid4()),
                    "paper_name": paper_name,
                    "year": year,
                    "shift": shift,
                    "subject": current_subject,
                    "question_number": q_counter,  # Continuous global question counter 1..100
                    "question_text": q_full_text,
                    "question_image": q_image,
                    "option_a": options["A"],
                    "option_b": options["B"],
                    "option_c": options["C"],
                    "option_d": options["D"],
                    "correct_answer": correct_answer,
                    "official_explanation": None,
                    "marks": 2.0,
                    "negative_marks": 0.5,
                    "source_pdf": pdf_filename
                })
                q_counter += 1
        else:
            i += 1

    return questions

def extract_standard_questions(doc: fitz.Document, metadata: Dict[str, Any], img_out_dir: str) -> List[Dict[str, Any]]:
    """Extracts questions using spatial layout block sorting and PyMuPDF fast table finder."""
    questions = []
    pdf_filename = metadata["filename"]
    paper_name = metadata["paper_name"]
    year = metadata["year"]
    shift = metadata["shift"]

    all_blocks = []
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        sorted_blocks = get_layout_sorted_blocks(page)
        tbl_md = extract_tables_from_fitz_page(page)
        
        for b in sorted_blocks:
            all_blocks.append({
                "text": b[4],
                "bbox": (b[0], b[1], b[2], b[3]),
                "page": page_idx + 1,
                "table_md": tbl_md
            })

    current_subject = "Quantitative Aptitude"
    i = 0
    while i < len(all_blocks):
        b = all_blocks[i]
        block_text = b["text"]

        if "Reasoning" in block_text:
            current_subject = "General Intelligence & Reasoning"
        elif "English" in block_text:
            current_subject = "English Comprehension"
        elif "Awareness" in block_text or "GK" in block_text:
            current_subject = "General Awareness"
        elif "Math" in block_text or "Quantitative" in block_text:
            current_subject = "Quantitative Aptitude"

        q_match = re.match(r'^(?:Q\s*\.?\s*)?(\d{1,3})\s*[\.\)]\s*(.+)', block_text, re.DOTALL | re.I)
        if q_match:
            q_num = int(q_match.group(1))
            q_body = q_match.group(2).strip()
            start_i = i
            
            q_text_lines = [q_body]
            options = {"A": None, "B": None, "C": None, "D": None}
            correct_ans = None
            explanation = None
            page_num = b["page"]
            
            q_image = extract_images_from_page(doc[page_num - 1], pdf_filename, page_num, q_num, img_out_dir)

            if b.get("table_md"):
                q_text_lines.append(b["table_md"])

            i += 1
            while i < len(all_blocks):
                curr_b = all_blocks[i]
                curr_text = curr_b["text"]

                # Break on next question header
                if i != start_i and re.match(r'^(?:Q\s*\.?\s*)?\d{1,3}\s*[\.\)]', curr_text, re.I):
                    break

                parsed_opts = parse_inline_options(curr_text)
                if any(parsed_opts.values()):
                    for k, v in parsed_opts.items():
                        if v and not options[k]:
                            options[k] = v
                elif re.match(r'^Ans(?:wer)?\s*[:\.]?\s*([A-D1-4])', curr_text, re.I):
                    ans_val = re.match(r'^Ans(?:wer)?\s*[:\.]?\s*([A-D1-4])', curr_text, re.I).group(1).upper()
                    key_map = {"1": "A", "2": "B", "3": "C", "4": "D"}
                    correct_ans = key_map.get(ans_val, ans_val)
                elif re.match(r'^(?:Sol|Explanation)\s*[:\.]?\s*(.+)', curr_text, re.I):
                    explanation = curr_text
                else:
                    q_text_lines.append(curr_text)
                i += 1

            q_full_text = normalize_math_to_latex(" ".join(q_text_lines).strip())
            
            if q_full_text and len(q_full_text) > 5 and (options["A"] or options["B"] or q_image):
                questions.append({
                    "id": str(uuid.uuid4()),
                    "paper_name": paper_name,
                    "year": year,
                    "shift": shift,
                    "subject": current_subject,
                    "question_number": q_num,
                    "question_text": q_full_text,
                    "question_image": q_image,
                    "option_a": options["A"],
                    "option_b": options["B"],
                    "option_c": options["C"],
                    "option_d": options["D"],
                    "correct_answer": correct_ans,
                    "official_explanation": explanation,
                    "marks": 2.0,
                    "negative_marks": 0.5,
                    "source_pdf": pdf_filename
                })
        else:
            i += 1

    return questions

def extract_questions_from_pdf(filepath: str, metadata: Dict[str, Any], img_out_dir: str) -> List[Dict[str, Any]]:
    """Master extraction dispatcher for a given PDF file."""
    doc = fitz.open(filepath)
    pdf_type = metadata.get("pdf_type", "standard_question_paper")
    
    if pdf_type == "tcs_question_paper":
        questions = extract_tcs_questions(doc, metadata, img_out_dir)
    else:
        questions = extract_standard_questions(doc, metadata, img_out_dir)

    doc.close()
    return questions
