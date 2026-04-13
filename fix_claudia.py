with open('europoi_chatbot.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

oud = '- Bij andere vragen: vriendelijk aangeven dat je alleen EuroPoi-vragen beantwoordt\n'

nieuw = (
    '- Bij vragen over apps die samen met EuroPoi worden gebruikt (zoals Komoot of OsmAnd):'
    ' geef uitleg vanuit de EuroPoi-context en verwijs voor verdere informatie naar de eigen website van die app\n'
    '- Bij vragen die buiten EuroPoi vallen: verwijs vriendelijk naar relevante bronnen op internet\n'
    '- Als ClaudIA er niet uitkomt: verwijs naar www.europoi.nl of duyfje@icloud.com\n'
)

if oud in lines:
    idx = lines.index(oud)
    lines[idx] = nieuw
    with open('europoi_chatbot.html', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('GELUKT')
else:
    print('NIET GEVONDEN')