"""Build the Embroidery Machine Operator employment application PDF.

Generates a simple, plain-language, two-page (one sheet, front/back) fillable
application on 8.5x11 with reportlab AcroForm fields, then post-processes with
pypdf to set /NeedAppearances (without it, a returned typed copy opens BLANK in
viewers that don't regenerate appearance streams -- see LESSONS_LEARNED_ARCHIVE
2026-08-17) and verifies the written copy: page count, page size, field-name
set, and the NeedAppearances flag.

Output: forms/embroidery-machine-operator-application.pdf
Listed in the Caspio Forms_Library table (Employee / HR) -> Forms Library page.

The printed rules and checkbox squares are drawn in page content (they always
print); the AcroForm widgets are borderless overlays on top, so the blank
printout looks like a classic paper application and the same file types cleanly.

This script is NOT a temp script -- it's the permanent builder for this form.
Run: python scripts/build-embroidery-operator-application-pdf.py
"""
import io
import os
import sys

from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
from pypdf.generic import BooleanObject, NameObject, TextStringObject

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(SCRIPT_DIR, 'fonts')
OUT_PATH = os.path.join(SCRIPT_DIR, '..', 'forms', 'embroidery-machine-operator-application.pdf')

PAGE_W, PAGE_H = letter          # 612 x 792
MARGIN = 40
CONTENT_W = PAGE_W - 2 * MARGIN

GREEN_DEEP = HexColor('#175C28')
GREEN_BRIGHT = HexColor('#23843A')
INK = HexColor('#20302a')
LABEL_GRAY = HexColor('#5a6a60')
RULE_GRAY = HexColor('#9aa8a0')

pdfmetrics.registerFont(TTFont('AppSans', os.path.join(FONTS, 'SourceSans3-Regular.ttf')))
pdfmetrics.registerFont(TTFont('AppSans-Bold', os.path.join(FONTS, 'SourceSans3-Bold.ttf')))
pdfmetrics.registerFont(TTFont('AppSans-It', os.path.join(FONTS, 'SourceSans3-It.ttf')))
pdfmetrics.registerFont(TTFont('AppSerif-Bold', os.path.join(FONTS, 'SourceSerif4-Bold.ttf')))

field_names = []                 # every field registered, for post-write verification


class FormPage:
    """y-cursor layout helper. y is the TOP of the next element (PDF coords)."""

    def __init__(self, c):
        self.c = c
        self.y = PAGE_H - MARGIN

    def spacer(self, h):
        self.y -= h

    def section(self, title):
        self.y -= 6
        c = self.c
        bar_h = 15
        c.setFillColor(GREEN_DEEP)
        c.rect(MARGIN, self.y - bar_h, CONTENT_W, bar_h, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont('AppSans-Bold', 9.5)
        c.drawString(MARGIN + 6, self.y - bar_h + 4, title.upper())
        self.y -= bar_h + 4

    def text(self, s, font='AppSans', size=8.5, color=INK, leading=None, x=MARGIN):
        self.c.setFillColor(color)
        self.c.setFont(font, size)
        self.c.drawString(x, self.y - size, s)
        self.y -= (leading or size + 3)

    def row(self, cells, height=33, write_h=18):
        """One row of underlined text fields.
        cells = [(label, name, weight), ...] or (label, name, weight, prefill)."""
        c = self.c
        gap = 14
        total_w = CONTENT_W - gap * (len(cells) - 1)
        weight_sum = sum(cell[2] for cell in cells)
        x = MARGIN
        line_y = self.y - height + 4
        for cell in cells:
            label, name, weight = cell[0], cell[1], cell[2]
            value = cell[3] if len(cell) > 3 else ''
            w = total_w * weight / weight_sum
            c.setFillColor(LABEL_GRAY)
            c.setFont('AppSans', 7.5)
            c.drawString(x, self.y - 8, label.upper())
            c.setStrokeColor(RULE_GRAY)
            c.setLineWidth(0.7)
            c.line(x, line_y, x + w, line_y)
            self._textfield(name, x + 1, line_y + 1, w - 2, write_h, value=value)
            x += w + gap
        self.y -= height

    def checks(self, items, cols=2, row_h=17, box=10, label_size=8.5):
        """Checkbox grid. items = [(label, name), ...]"""
        c = self.c
        col_w = CONTENT_W / cols
        for i, (label, name) in enumerate(items):
            col, r = i % cols, i // cols
            x = MARGIN + col * col_w
            top = self.y - r * row_h
            self._checkbox(name, x, top - box - 2, box)
            c.setFillColor(INK)
            c.setFont('AppSans', label_size)
            c.drawString(x + box + 5, top - box, label)
        self.y -= row_h * ((len(items) + cols - 1) // cols)

    def yes_no(self, question, name, x=MARGIN, bold=False, size=8.5):
        """A question with Yes / No checkboxes on one line."""
        c = self.c
        box = 10
        c.setFillColor(INK)
        c.setFont('AppSans-Bold' if bold else 'AppSans', size)
        c.drawString(x, self.y - box, question)
        qx = x + c.stringWidth(question, 'AppSans-Bold' if bold else 'AppSans', size) + 12
        for suffix, label in (('yes', 'Yes'), ('no', 'No')):
            self._checkbox('%s_%s' % (name, suffix), qx, self.y - box - 2, box)
            c.setFont('AppSans', size)
            c.drawString(qx + box + 4, self.y - box, label)
            qx += box + 4 + c.stringWidth(label, 'AppSans', size) + 14
        self.y -= 17

    def write_lines(self, name, n_lines, line_h=17):
        """n ruled lines with ONE multiline field spanning them."""
        c = self.c
        box_h = n_lines * line_h
        top = self.y
        c.setStrokeColor(RULE_GRAY)
        c.setLineWidth(0.7)
        for i in range(1, n_lines + 1):
            ly = top - i * line_h
            c.line(MARGIN, ly, MARGIN + CONTENT_W, ly)
        self._textfield(name, MARGIN + 1, top - box_h + 1, CONTENT_W - 2, box_h - 2,
                        multiline=True)
        self.y -= box_h + 4

    # -- borderless AcroForm widgets (page content draws the printed rules) --

    def _textfield(self, name, x, y, w, h, multiline=False, value=''):
        field_names.append(name)
        self.c.acroForm.textfield(
            name=name, x=x, y=y, width=w, height=h, value=value,
            fontName='Helvetica', fontSize=9, textColor=black,
            borderWidth=0, borderColor=None, fillColor=None,
            maxlen=4000, fieldFlags='multiline' if multiline else '',
            tooltip=name.replace('_', ' '))

    def _checkbox(self, name, x, y, size):
        field_names.append(name)
        self.c.setStrokeColor(INK)
        self.c.setLineWidth(0.9)
        self.c.rect(x, y, size, size, stroke=1, fill=0)
        self.c.acroForm.checkbox(
            name=name, x=x, y=y, size=size, checked=False, buttonStyle='check',
            borderWidth=0, borderColor=None, fillColor=None, textColor=black,
            tooltip=name.replace('_', ' '))


def header(p):
    c = p.c
    c.setFillColor(GREEN_DEEP)
    c.setFont('AppSerif-Bold', 17)
    c.drawString(MARGIN, p.y - 15, 'Northwest Custom Apparel')
    c.setFillColor(LABEL_GRAY)
    c.setFont('AppSans', 8)
    c.drawString(MARGIN, p.y - 27, 'Family-owned in Milton, WA since 1977')
    c.setFont('AppSans', 8)
    c.drawRightString(PAGE_W - MARGIN, p.y - 10, '2025 Freeman Road East')
    c.drawRightString(PAGE_W - MARGIN, p.y - 20, 'Milton, WA 98354')
    c.drawRightString(PAGE_W - MARGIN, p.y - 30, '(253) 922-5793')
    p.y -= 38

    bar_h = 22
    c.setFillColor(GREEN_BRIGHT)
    c.rect(MARGIN, p.y - bar_h, CONTENT_W, bar_h, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont('AppSans-Bold', 12)
    c.drawCentredString(PAGE_W / 2, p.y - bar_h + 6,
                        'EMPLOYMENT APPLICATION  —  EMBROIDERY MACHINE OPERATOR')
    p.y -= bar_h + 6

    c.setFillColor(LABEL_GRAY)
    c.setFont('AppSans-It', 7.5)
    c.drawString(MARGIN, p.y - 8,
                 'Northwest Custom Apparel is an equal opportunity employer. All qualified applicants are considered without regard to race, color,')
    c.drawString(MARGIN, p.y - 17,
                 'religion, sex, national origin, age, disability, or any other legally protected status. Please print clearly.')
    p.y -= 24


def footer(c, text_left, page_label):
    c.setFillColor(LABEL_GRAY)
    c.setFont('AppSans', 7.5)
    c.drawString(MARGIN, 26, text_left)
    c.drawRightString(PAGE_W - MARGIN, 26, page_label)


def build_page_1(p):
    header(p)

    p.section('1. About You')
    p.row([('Full name', 'name', 3), ("Today's date", 'date', 1)])
    p.row([('Phone', 'phone', 1), ('Email', 'email', 1.6)])
    p.row([('Street address', 'address', 2.2), ('City', 'city', 1),
           ('State', 'state', 0.4), ('ZIP', 'zip', 0.6)])

    p.section('2. Position & Availability')
    p.row([('Position you are applying for', 'position', 1.6, 'Embroidery Machine Operator'),
           ('Date you can start', 'start_date', 1),
           ('Pay expected ($ / hour)', 'pay_expected', 1)])
    p.spacer(2)
    p.c.setFillColor(INK)
    p.c.setFont('AppSans', 8.5)
    p.c.drawString(MARGIN, p.y - 10, 'I am looking for:')
    saved_y = p.y
    p.y -= 0
    x0 = MARGIN + 78
    box = 10
    for suffix, label in (('full_time', 'Full-time'), ('part_time', 'Part-time'), ('either', 'Either')):
        p._checkbox('work_' + suffix, x0, p.y - box - 2, box)
        p.c.setFillColor(INK)
        p.c.setFont('AppSans', 8.5)
        p.c.drawString(x0 + box + 4, p.y - box, label)
        x0 += box + 4 + p.c.stringWidth(label, 'AppSans', 8.5) + 18
    p.y = saved_y - 17
    p.row([('Days and hours you are available to work', 'availability', 1)])
    p.yes_no('Are you legally authorized to work in the United States?', 'work_authorized')
    p.yes_no('Are you 18 years of age or older?', 'age_18')

    p.section('3. Sewing & Embroidery Experience')
    p.yes_no('Do you have any sewing or embroidery experience?', 'has_experience', bold=True, size=9.5)
    p.text('If yes, tell us about it — machines you have used, years of experience, and the kind of work you did:',
           size=8.5, leading=13)
    p.write_lines('experience_detail', 4, line_h=18)
    p.text('Check any that apply to you:', font='AppSans-Bold', size=8.5, leading=14)
    p.checks([
        ('Commercial embroidery machines (Tajima, Barudan, Melco…)', 'exp_commercial_emb'),
        ('Home / single-head embroidery machine', 'exp_home_emb'),
        ('Sewing or alterations', 'exp_sewing'),
        ('Garment or textile production work', 'exp_production'),
        ('Heat press or garment finishing', 'exp_finishing'),
        ('Machine upkeep (threading, tension, needles)', 'exp_maintenance'),
    ])
    p.spacer(2)
    p.row([('Other machines or production equipment you have operated', 'other_equipment', 1)])
    p.row([('Anything else you would like us to know?', 'anything_else', 1)])

    footer(p.c, 'Please complete both sides of this application.', 'Page 1 of 2')


def build_page_2(p):
    c = p.c
    c.setFillColor(GREEN_DEEP)
    c.setFont('AppSans-Bold', 10)
    c.drawString(MARGIN, p.y - 10, 'Employment Application — Embroidery Machine Operator')
    c.setFillColor(LABEL_GRAY)
    c.setFont('AppSans', 8)
    c.drawRightString(PAGE_W - MARGIN, p.y - 10, 'Northwest Custom Apparel')
    c.setStrokeColor(GREEN_DEEP)
    c.setLineWidth(1)
    c.line(MARGIN, p.y - 16, PAGE_W - MARGIN, p.y - 16)
    p.y -= 24

    p.section('4. Work History  (start with your most recent job)')
    for i in (1, 2):
        p.row([('Company', 'job%d_company' % i, 2), ('Phone', 'job%d_phone' % i, 1)])
        p.row([('Your job title', 'job%d_title' % i, 1.4),
               ('From (month / year)', 'job%d_from' % i, 1),
               ('To (month / year)', 'job%d_to' % i, 1)])
        p.row([('What did you do there?', 'job%d_duties' % i, 1)])
        p.row([('Reason for leaving', 'job%d_reason' % i, 1)], height=28)
        p.yes_no('May we contact this employer?', 'job%d_contact' % i)
        if i == 1:
            p.spacer(6)

    p.section('5. Education & Training')
    p.row([('Highest grade or degree completed', 'education_level', 1), ('School', 'education_school', 1.4)])
    p.row([('Certificates or training related to sewing, embroidery, or production', 'training', 1)])

    p.section('6. References  (people who know your work — not family)')
    p.row([('Name', 'ref1_name', 1.4), ('How do they know you?', 'ref1_relation', 1), ('Phone', 'ref1_phone', 1)])
    p.row([('Name', 'ref2_name', 1.4), ('How do they know you?', 'ref2_relation', 1), ('Phone', 'ref2_phone', 1)])

    p.section('7. Please Read & Sign')
    for line in (
        'I certify that the answers on this application are true and complete to the best of my knowledge. I understand that false or',
        'misleading information may end my application or, if I am hired, my employment. I authorize Northwest Custom Apparel to',
        'contact the employers and references listed above (except any employer I marked "No"). I understand this application is not',
        'a contract of employment and that, if hired, my employment will be at-will.',
    ):
        p.text(line, size=8, leading=11)
    p.spacer(6)
    p.row([('Applicant signature', 'signature', 2), ('Date', 'signature_date', 1)], height=32, write_h=18)

    footer(p.c, 'Return to: Northwest Custom Apparel · 2025 Freeman Road East, Milton, WA 98354 · (253) 922-5793',
           'Page 2 of 2')


def main():
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setTitle('Employment Application — Embroidery Machine Operator')
    c.setAuthor('Northwest Custom Apparel')

    build_page_1(FormPage(c))
    c.showPage()
    build_page_2(FormPage(c))
    c.showPage()
    c.save()

    # /NeedAppearances so a copy typed in any viewer renders when we open it,
    # plus a form-level /DA fallback (same fix as the business credit app).
    buf.seek(0)
    writer = PdfWriter()
    writer.append(PdfReader(buf))
    acro = writer._root_object['/AcroForm']
    acro[NameObject('/NeedAppearances')] = BooleanObject(True)
    acro[NameObject('/DA')] = TextStringObject('/Helv 0 Tf 0 g')
    out_path = os.path.normpath(OUT_PATH)
    with open(out_path, 'wb') as f:
        writer.write(f)

    # Verify the WRITTEN copy (PdfWriter can silently drop the AcroForm).
    check = PdfReader(out_path)
    assert len(check.pages) == 2, 'expected 2 pages, got %d' % len(check.pages)
    box = check.pages[0].mediabox
    assert (round(box.width), round(box.height)) == (612, 792), 'not 8.5x11: %s' % box
    written = set((check.get_fields() or {}).keys())
    expected = set(field_names)
    assert written == expected, 'field mismatch: missing %s / extra %s' % (
        sorted(expected - written), sorted(written - expected))
    assert check.trailer['/Root']['/AcroForm']['/NeedAppearances'], '/NeedAppearances not set'
    print('OK: %s — 2 pages, %d fields, /NeedAppearances set, %d bytes'
          % (out_path, len(written), os.path.getsize(out_path)))


if __name__ == '__main__':
    sys.exit(main())
