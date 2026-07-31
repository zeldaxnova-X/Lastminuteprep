"""
PDF Classifier & Inventory Scanner for SSC CGL Ingestion Pipeline
"""
import os
import re
import fitz
import json
from typing import Dict, List, Any

def classify_pdf(filename: str, filepath: str) -> Dict[str, Any]:
    metadata = {
        "filename": filename,
        "filepath": filepath,
        "pdf_type": "standard_question_paper",
        "year": 2024,
        "shift": "Shift 1",
        "tier": "Tier I",
        "date": None,
        "subject": "General",
        "paper_name": filename.replace(".pdf", "")
    }

    # Extract Year
    year_match = re.search(r'\b(201[89]|202[0-9])\b', filename)
    if year_match:
        metadata["year"] = int(year_match.group(1))

    # Extract Shift
    shift_match = re.search(r'\b(Shift|S)[-_\s]*([1-4])\b', filename, re.IGNORECASE)
    if shift_match:
        metadata["shift"] = f"Shift {shift_match.group(2)}"

    # Extract Tier
    if re.search(r'Tier[-_\s]*II|Paper[-_\s]*I\b|Mains', filename, re.IGNORECASE):
        metadata["tier"] = "Tier II"
    elif re.search(r'Tier[-_\s]*I\b', filename, re.IGNORECASE):
        metadata["tier"] = "Tier I"

    try:
        doc = fitz.open(filepath)
        text_sample = ""
        # Scan first 5 pages for comprehensive metadata and layout indicators
        for i in range(min(5, len(doc))):
            text_sample += doc[i].get_text() + " "
        doc.close()

        text_lower = text_sample.lower()
        
        # TCS iON Response Sheet Detection
        tcs_indicators = [
            "chosen option", "question id", "option 1 id", "option 2 id",
            "ion digital zone", "status : answered", "status : not answered",
            "cgle 20", "combined graduate level examination"
        ]
        
        if "answer key" in filename.lower() or "ans key" in filename.lower():
            metadata["pdf_type"] = "answer_key"
        elif "solution" in filename.lower() or "solved paper" in filename.lower():
            metadata["pdf_type"] = "solution"
        elif any(indicator in text_lower for indicator in tcs_indicators):
            metadata["pdf_type"] = "tcs_question_paper"
        else:
            metadata["pdf_type"] = "standard_question_paper"

        # Date extraction from text
        date_match = re.search(r'(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})', text_sample)
        if date_match:
            metadata["date"] = f"{date_match.group(3)}-{int(date_match.group(2)):02d}-{int(date_match.group(1)):02d}"

        clean_name = f"SSC CGL {metadata['year']} {metadata['tier']} {metadata['shift']}"
        if metadata["date"]:
            clean_name += f" ({metadata['date']})"
        metadata["paper_name"] = clean_name

    except Exception as e:
        metadata["error"] = str(e)

    return metadata

def scan_pdf_directory(pdf_dir: str) -> List[Dict[str, Any]]:
    inventory = []
    if not os.path.exists(pdf_dir):
        print(f"Directory not found: {pdf_dir}")
        return inventory

    for fname in sorted(os.listdir(pdf_dir)):
        if fname.lower().endswith(".pdf"):
            fpath = os.path.join(pdf_dir, fname)
            info = classify_pdf(fname, fpath)
            inventory.append(info)

    return inventory

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    target_dir = r"c:\Users\jijo1\OneDrive\Desktop\Lastmileprep latest\ssc cgl\English"
    results = scan_pdf_directory(target_dir)
    print(f"Scanned {len(results)} PDFs.")
    
    os.makedirs("reports", exist_ok=True)
    with open(os.path.join("reports", "pdf_inventory.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved inventory to reports/pdf_inventory.json")
