import smtplib
from email.message import EmailMessage
from fastapi import UploadFile, HTTPException
import logging

logger = logging.getLogger(__name__)

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "zakinabeel522@gmail.com"  # TODO: move to env var
SMTP_PASS = "ytdu babt xwte gqas"       # TODO: move to env var

async def send_report_email(pdf: UploadFile, to: str, subject: str, body: str):
    if not pdf.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    pdf_bytes = await pdf.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="PDF file is empty")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = to
    msg.set_content(body)
    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=pdf.filename or "drilling_report.pdf")
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
    return {"message": "Email sent successfully!"}
