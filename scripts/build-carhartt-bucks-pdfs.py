"""Reproduce the approved flyer and a blank staff visit log. No customer data."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'forms'
OUT.mkdir(exist_ok=True)

def build():
    pdf = canvas.Canvas(str(OUT / 'carhartt-bucks-certificate.pdf'), pagesize=letter)
    pdf.setTitle('Carhartt Bucks 2026 - Showroom Reward Certificate')
    pdf.setAuthor('Northwest Custom Apparel')
    pdf.drawImage(str(ROOT / 'images/promotions/carhartt-bucks-2026.png'),
                  18, 18, width=576, height=756, preserveAspectRatio=True, anchor='c')
    pdf.showPage()
    pdf.save()

    pdf = canvas.Canvas(str(OUT / 'carhartt-bucks-visit-log.pdf'), pagesize=landscape(letter))
    pdf.setTitle('Carhartt Bucks 2026 - Showroom Visit and Redemption Log')
    pdf.setAuthor('Northwest Custom Apparel')
    green = HexColor('#122b18')
    pdf.setFillColor(green)
    pdf.setFont('Helvetica-Bold', 22)
    pdf.drawString(30, 570, 'Carhartt Bucks | Showroom visit log')
    pdf.setFont('Helvetica', 10)
    pdf.drawString(30, 548, 'Visit by September 30, 2026. Qualifying Carhartt order of $1,000+ by October 15, 2026. $100 credit toward that order.')
    pdf.drawString(30, 532, 'One certificate per company. Cannot be combined with other offers. Record the same details in the customer account.')
    pdf.drawString(30, 508, 'Rep: ____________________________________    Log period: ______________________________')
    cols = [30, 172, 310, 388, 459, 567, 640, 706, 762]
    heads = ['Company', 'Contact / phone', 'Rep', 'Visit date', 'Certificate issued', 'Order #', 'Order date', 'Credit']
    pdf.setFillColor(green)
    pdf.rect(30, 461, 732, 28, fill=1, stroke=0)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont('Helvetica-Bold', 8)
    for x, label in zip(cols, heads):
        pdf.drawString(x+5, 472, label)
    pdf.setStrokeColor(HexColor('#c7d0c8'))
    pdf.setLineWidth(0.5)
    for i in range(9):
        y = 461 - 46*i
        pdf.line(30, y, 762, y)
    for x in cols:
        pdf.line(x, 93, x, 461)
    pdf.setFillColor(green)
    pdf.setFont('Helvetica', 9)
    pdf.drawString(30, 69, 'At order placement: verify the visit date, qualifying order amount, one certificate per company and no combined offer.')
    pdf.drawString(30, 53, 'Certificate reference: NWCA1977. Note the $100 credit in the order record. Keep completed logs with showroom records.')
    pdf.setFont('Helvetica', 8)
    pdf.drawString(30, 29, 'Northwest Custom Apparel | 2025 Freeman Road East, Milton, WA 98354 | 253-922-5793')
    pdf.showPage()
    pdf.save()

if __name__ == '__main__':
    build()
