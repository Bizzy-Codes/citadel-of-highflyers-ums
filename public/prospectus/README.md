# Prospectus & welcome letter files

Drop the real files in this folder using these **exact** filenames. The
site picks them up on the next refresh with no code change.

| Filename | Shown to |
|---|---|
| `kindergarten-prospectus.jpg` | Families applying for Daycare / Reception / Kindergarten / Pre-Grade |
| `graders-prospectus.jpg` | Families applying for Grade 1 – Grade 5 |

JPG, PNG or PDF all work — if you use a different extension, update the
`PROSPECTUS` map in `src/lib/outreach.ts` to match.

## While a file is missing

Nothing breaks. The admissions confirmation screen checks whether each
file actually exists and simply doesn't show a button for one that
isn't there yet, rather than handing a family a broken link.

## Which one a family is offered

Families no longer choose a class on the admission form (the admin picks
the class when admitting), so the site works the section out from the
child's **date of birth**: age 6 or over by 1 September is Graders,
anything younger is Kindergarten. The confirmation screen shows the
matching prospectus first and the other one alongside it, so a family
can always get the right sheet even if the guess is off.

The same section keyword is written into the WhatsApp message the family
sends (`SECTION: KINDERGARTEN` / `SECTION: GRADERS`) so whoever is on the
school line knows which sheet to reply with at a glance.
