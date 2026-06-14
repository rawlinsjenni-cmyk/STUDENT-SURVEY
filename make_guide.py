# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, HRFlowable, ListFlowable, ListItem)

OUT = r"C:\Users\rawli\Desktop\Student Survey App - User Guide.pdf"
RED = colors.HexColor("#8B0000")
GREY = colors.HexColor("#555555")
LIGHT = colors.HexColor("#f4f0ef")

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], textColor=RED, fontSize=15,
                    spaceBefore=11, spaceAfter=5)
BODY = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10.5, leading=15,
                      spaceAfter=6)
STEP = ParagraphStyle("Step", parent=BODY, leftIndent=14)
NOTE = ParagraphStyle("Note", parent=BODY, fontSize=9.5, textColor=GREY)
TITLE = ParagraphStyle("Title", parent=styles["Title"], textColor=colors.white,
                       fontSize=22, spaceAfter=2, alignment=0)
SUB = ParagraphStyle("Sub", parent=styles["Normal"], textColor=colors.white,
                     fontSize=11, alignment=0)

def steps(items):
    return ListFlowable(
        [ListItem(Paragraph(t, BODY), value=i+1) for i, t in enumerate(items)],
        bulletType="1", leftIndent=18, bulletColor=RED, bulletFontName="Helvetica-Bold")

def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, BODY)) for t in items],
        bulletType="bullet", leftIndent=18, bulletColor=RED)

def hr():
    return HRFlowable(width="100%", thickness=0.7, color=colors.HexColor("#dddddd"),
                      spaceBefore=10, spaceAfter=4)

story = []

# ---- Title banner ----
banner = Table([[Paragraph("Student Survey App", TITLE)],
                [Paragraph("User Guide &mdash; The Salvation Army", SUB)]],
               colWidths=[6.7*inch])
banner.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), RED),
    ("LEFTPADDING", (0,0), (-1,-1), 16),
    ("RIGHTPADDING", (0,0), (-1,-1), 16),
    ("TOPPADDING", (0,0), (0,0), 14),
    ("BOTTOMPADDING", (0,-1), (-1,-1), 14),
]))
story += [banner, Spacer(1, 14)]

story.append(Paragraph(
    "This is a simple guide for using the Student Survey App. You can do everything "
    "yourself from any computer or phone with internet &mdash; nothing needs to be installed.", BODY))

# ---- 1. Opening ----
story.append(Paragraph("1. Opening your admin page", H1))
story.append(Paragraph("Open this web address in any browser (Chrome, Edge, Safari):", BODY))
addr = Table([[Paragraph("<b>https://student-survey-8a0q.onrender.com/admin</b>", BODY)]],
             colWidths=[6.7*inch])
addr.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),LIGHT),
                          ("BOX",(0,0),(-1,-1),0.5,colors.HexColor("#cccccc")),
                          ("LEFTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),8),
                          ("BOTTOMPADDING",(0,0),(-1,-1),8)]))
story += [addr, Spacer(1, 6)]
story.append(Paragraph("Then log in with:", BODY))
login = Table([["Username", "admin"], ["Password", "resul.guler44"]], colWidths=[1.5*inch, 5.2*inch])
login.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(0,-1),LIGHT),
    ("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),
    ("GRID",(0,0),(-1,-1),0.5,colors.HexColor("#dddddd")),
    ("LEFTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
]))
story += [login, Spacer(1, 4)]
story.append(Paragraph("Tip: save this page as a bookmark so it is easy to find next time. "
                       "Keep your password private &mdash; only you should see the answers.", NOTE))

# ---- 2. Tabs ----
story.append(hr())
story.append(Paragraph("2. The three tabs", H1))
story.append(bullets([
    "<b>Students</b> &mdash; add students, send them their survey link, and see who has finished.",
    "<b>Questions</b> &mdash; add, change, remove, or reorder the questions.",
    "<b>Settings</b> &mdash; change your password and download (back up) your data.",
]))

# ---- 3. Send survey ----
story.append(hr())
story.append(Paragraph("3. Sending the survey to a student", H1))
story.append(steps([
    "Go to the <b>Students</b> tab and click <b>&ldquo;+ Add Student&rdquo;</b>.",
    "Type the student&rsquo;s name and email, then save.",
    "On that student&rsquo;s row, click <b>&ldquo;Copy&rdquo;</b> to copy their personal survey link.",
    "Paste the link into an email and send it to the student.",
    "The student opens the link on their phone or computer and fills it in.",
]))
story.append(Paragraph("Each student gets their own private link. You do not need to do anything "
                       "else &mdash; their answers arrive automatically.", NOTE))

# ---- 4. Who finished ----
story.append(hr())
story.append(Paragraph("4. Seeing who has finished", H1))
story.append(Paragraph("In the <b>Students</b> tab, each student shows a status:", BODY))
story.append(bullets([
    "<b>Completed</b> &mdash; the student has finished the survey.",
    "<b>Pending</b> &mdash; the student has not finished yet.",
]))

# ---- 5. View / print ----
story.append(Paragraph("5. Reading and printing a student&rsquo;s answers", H1))
story.append(steps([
    "On a completed student&rsquo;s row, click <b>&ldquo;View&rdquo;</b> to read all their answers.",
    "To print or save as PDF, click <b>&ldquo;Print&rdquo;</b> in that window.",
    "In the print window you can choose your printer, or choose &ldquo;Save as PDF&rdquo; to keep a copy on the computer.",
]))

# ---- 6. Questions ----
story.append(hr())
story.append(Paragraph("6. Changing the questions", H1))
story.append(Paragraph("In the <b>Questions</b> tab:", BODY))
story.append(bullets([
    "<b>Add</b> a new question with <b>&ldquo;+ Add Question&rdquo;</b>.",
    "<b>Edit</b> or <b>Delete</b> a question using the buttons next to it.",
    "<b>Reorder</b>: drag the grip handle (the dotted icon on the left), or use the up/down arrow buttons &mdash; for a whole section or a single question.",
    "<b>Conditional questions</b>: when adding/editing, you can choose to show a question only "
    "if an earlier Yes/No question has a certain answer (for example, only show follow-up "
    "questions when the answer is &ldquo;No&rdquo;).",
]))
story.append(Paragraph("All changes save automatically and students see them right away.", NOTE))

# ---- 7. Backup ----
story.append(hr())
story.append(Paragraph("7. Saving / backing up your data", H1))
story.append(Paragraph("In the <b>Settings</b> tab, under <b>&ldquo;Export &amp; Backup Data&rdquo;</b>:", BODY))
story.append(bullets([
    "<b>Download Backup (JSON)</b> &mdash; a complete backup. Keep it somewhere safe.",
    "<b>Download Spreadsheet (Excel/CSV)</b> &mdash; opens in Excel; one row per student.",
    "<b>Save All as PDF</b> &mdash; a printable report of every completed student.",
]))
story.append(Paragraph("It is a good habit to download a backup from time to time.", NOTE))

# ---- 8. Good to know ----
story.append(hr())
story.append(Paragraph("8. Good to know", H1))
story.append(bullets([
    "The web address never changes &mdash; it works even when your computer is off.",
    "Only you can see the answers, because they are behind your password.",
    "The site is on a free plan, so if it has not been used for about 15 minutes it &ldquo;sleeps.&rdquo; "
    "The first time someone opens it after that, it may take around 30 seconds to wake up. This is normal.",
    "To change your password: <b>Settings</b> tab &rarr; <b>Change Password</b>.",
]))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(RED); canvas.setLineWidth(1)
    canvas.line(0.9*inch, 0.55*inch, 7.6*inch, 0.55*inch)
    canvas.setFillColor(GREY); canvas.setFont("Helvetica", 8.5)
    canvas.drawCentredString(letter[0]/2, 0.4*inch, "Student Survey App  —  The Salvation Army")
    canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=letter,
                        leftMargin=0.9*inch, rightMargin=0.9*inch,
                        topMargin=0.7*inch, bottomMargin=0.7*inch,
                        title="Student Survey App - User Guide")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("PDF created:", OUT)
