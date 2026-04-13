import docx
import sys

def read_docx(filename):
    doc = docx.Document(filename)
    fullText = []
    for para in doc.paragraphs:
        fullText.append(para.text)
    return '\n'.join(fullText)

if __name__ == "__main__":
    text = read_docx(sys.argv[1])
    with open("extracted_breakdown.txt", "w", encoding="utf-8") as f:
        f.write(text)
