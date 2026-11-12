# Noch offene Workshop-Validierung

Stand: 12.11.2026. Punkte erst abhaken, wenn das erwartete Ergebnis tatsächlich beobachtet wurde.

## Bereits geprüft – keine manuelle Wiederholung nötig

- PRs #9 und #10 sind gemerged.
- Der Schutz für `main` ist gespeichert und aktiv: PR erforderlich, `Repository validation` erforderlich, Branch aktuell, Diskussionen geklärt, keine Ausnahmen, keine Force-Pushes oder Branch-Löschung. Zusätzliche menschliche Freigaben sind nicht erforderlich.
- PR #11: 37 Automatisierungstests, 4 Angular-Unit-Tests, 21 Browsertests und beide Builds waren erfolgreich. Die neueste [GitHub-Prüfung](https://github.com/jrubner/ki-software-engineer/actions/runs/43088574521) war erfolgreich. Eine absichtlich fehlschlagende Testprüfung wurde ebenfalls erkannt und anschließend zurückgesetzt.
- Die Prompt-Übung mit zwei Modellen ist laut deiner Bestätigung abgeschlossen.

## 1. Voraussetzung: PR #11 ist gemerged

- [x] [PR #11](https://github.com/jrubner/ki-software-engineer/pull/11) wurde geprüft und gemerged.
  - Ergebnis: `Repository validation` war für den letzten PR-Commit erfolgreich; auch der Lauf auf `main` nach dem Merge war erfolgreich.
  - Die Korrektur der Review-Veröffentlichung ist integriert. Der erste neue Review-Lauf auf PR #13 einschließlich Veröffentlichung war erfolgreich.
- [x] PR #11 wurde gemerged; die Korrekturen sind auf `main` verfügbar.
  - Die Abschnitte 2–4 können jetzt mit neuen Läufen geprüft werden.
  - Neue PRs bleiben bis zu einer gesonderten Merge-Freigabe offen.
  - Alte fehlgeschlagene Läufe nicht erneut starten: Sie verwenden weiterhin die alte Workflow-Version.

## 2. Automatische Umsetzung – nach dem Merge von PR #11

- [ ] [Issue #12](https://github.com/jrubner/ki-software-engineer/issues/12) öffnen. Das Label `ready-for-implementation` prüfen und anschließend `implementation-approved` hinzufügen.
  - Erwartet: **Issue Implementation with Codex** startet genau einmal.
  - Falls kein Start erfolgt: **Actions → Issue Implementation with Codex → Run workflow**, Branch `main`, `issue_number = 12`, `fingerprint` leer lassen.
  - Nicht manuell starten, solange bereits ein Umsetzungslauf aktiv ist.
- [ ] Den neuen Lauf öffnen und `prepare → implement → verify → publish` prüfen.
  - Erwartet: Alle vier Jobs sind erfolgreich; kein Installationsfehler wegen Ubuntu 26.04.
  - Red: Tests schlagen wegen des fehlenden Suchverhaltens fehl, nicht wegen eines Einrichtungsfehlers.
  - Green: Akzeptanztests bestehen. Blue: Refactoring im vereinbarten Umfang oder begründet keine weitere Änderung.
  - Unabhängiger Job `verify`: Unit-Tests, Browsertests der Anwendung und beide Builds bestehen.
- [ ] Den erzeugten PR und seine Nachweise prüfen.
  - Erwartet: Branch `codex/issue-12`, Commit-/PR-Titel nach Conventional Commits, Checkliste, Issue-Verknüpfung und Nachweise für AC-1 bis AC-4.
  - Den erzeugten PR und Issue #12 bis zu einer späteren Merge-Entscheidung offen lassen.

## 3. PR-Review und Aktualisierung – nach dem Merge von PR #11

Für einen unabhängigen Test ohne Feature-Umsetzung wird bereits [Dokumentations-PR #13](https://github.com/jrubner/ki-software-engineer/pull/13) verwendet. Sein [erster automatischer Review-Lauf](https://github.com/jrubner/ki-software-engineer/actions/runs/43180574889) war erfolgreich und der Bot-Kommentar ist sichtbar. Die Aktualisierung desselben Kommentars wird mit einem Folge-Commit geprüft. Der Review des später erzeugten Feature-PRs bleibt ein eigener Prüfschritt.

- [ ] Den erzeugten Feature-PR aus Abschnitt 2 verwenden und auf sein automatisches Review warten.
  - Falls es ausbleibt: **Actions → Pull Request Review with Codex → Run workflow**, Branch `main`, die PR-Nummer eintragen, `head_sha` leer lassen.
- [ ] `review` und `publish` prüfen, anschließend die PR-Diskussion öffnen.
  - Erwartet: Beide Jobs sind erfolgreich; ein sichtbarer Bot-Kommentar **Codex PR-Review** ist vorhanden.
  - Erwartet: Fünf Prüfbereiche sowie Einschränkungen; Befunde nennen betroffene Codestellen oder stellen ausdrücklich fest, dass keine belegbaren Befunde vorliegen.
  - Erwartet: Exakte aktuelle Head-/Base-Versionen, Modell `gpt-5.6-luna` und Link zum Lauf.
  - Ein Review-Kommentar ist weder eine menschliche Freigabe noch ein Nachweis bestandener Tests.
- [ ] Einen sinnvollen Folge-Commit auf diesem PR-Branch erstellen; Codex kann ihn vorbereiten.
  - Erwartet: Ein neues Review läuft und aktualisiert **denselben** Bot-Kommentar auf die neue Head-Version. Menschliche Kommentare bleiben unverändert.
  - Den PR offen lassen; ein Merge zur Demonstration ist nicht nötig.

## 4. Buchsuche: kurze sichtbare Abnahme

Nur mit dem Stand des erzeugten Feature-PRs ausführen. Codex kann diesen Stand auschecken und mit den vorhandenen lokalen Diensten bereitstellen. Du musst keinen weiteren Browser oder Entwicklungsserver selbst einrichten.

- [ ] Zwei unterschiedliche Suchbegriffe kurz nacheinander eingeben.
  - Erwartet: Die abschließenden Ergebnisse passen zum letzten Begriff; eine ältere Antwort überschreibt sie nie.
- [ ] Einen Begriff eingeben und sofort **Clear search** anklicken; während des Ladens wiederholen.
  - Erwartet: Leeres Eingabefeld und ungefilterte Liste; kein verzögertes gefiltertes Ergebnis erscheint erneut.
- [ ] Mit einer Suche beginnen, sofort ein Buchdetail öffnen und anschließend zur Liste zurückkehren.
  - Erwartet: Die Detailnavigation funktioniert; nach dem Verlassen startet keine verzögerte Listensuche. Die Liste bleibt nach der Rückkehr bedienbar.
- [ ] In den DevTools unter **Network** vorübergehend die Anfrage für die Buchliste blockieren, suchen, die Blockierung aufheben und erneut suchen.
  - Erwartet: Der Ladezustand endet nach dem Fehler und die nächste Suche funktioniert.
  - Die vorübergehende Blockierung anschließend entfernen; eine neue Fehleransicht ist nicht erforderlich.
- Zeitkritische Abbrüche und Antworten in umgekehrter Reihenfolge benötigen zusätzlich kontrollierte automatisierte Tests. Eine erfolgreiche Sichtprüfung allein belegt diese Fälle nicht.

## 5. Prüfungen durch den Kontoinhaber

- [ ] Prüfen, ob `PAT_TOKEN` und `ANTHROPIC_API_KEY` anderweitig verwendet werden.
  - Erwartet: Nur nachweislich ungenutzte Zugangsdaten widerrufen bzw. entfernen. Diese Codex-Workflows verwenden `OPENAI_API_KEY` und jobbezogene Berechtigungen des `GITHUB_TOKEN`.
  - Keine geheimen Werte im Chat senden. Die Kontobestätigung ist bereits abgeschlossen.
- [ ] Vor dem 2. Dezember 2026 die GitHub-Actions-Richtlinienhinweise zur Einschränkung von `pull_request_target` in öffentlichen Repositories prüfen.
  - Erwartet: Eine passende Ereignisrichtlinie erlaubt den benötigten vertrauenswürdigen Review-Workflow, wenn automatische PR-Reviews weiterlaufen sollen. Codex kann das mit dir prüfen.
  - Code aus dem PR-Head nicht mit erhöhten Rechten ausführen. Ein manueller Start über `workflow_dispatch` bleibt die Alternative, wenn automatische Ereignisse blockiert werden.

## Was du tatsächlich selbst machen musst

- Entscheiden, ob neue PRs gemerged werden dürfen; diese Berechtigung hat Codex bisher nicht.
- Neue Anmelde- oder Kontobestätigungsdialoge selbst abschließen.
- Bestätigen, wem Zugangsdaten gehören, wo sie sonst verwendet werden und ob die Oberfläche deinen Erwartungen entspricht.
- Codex kann Workflow-Läufe starten, Logs prüfen, erzeugten Code validieren, Browsertests ausführen und Nachweise festhalten. Du musst die Abschnitte 2–4 nicht manuell ausführen, wenn Codex sie nach Erfüllung der Voraussetzung übernehmen soll.
- Links zu erfolgreichen Läufen, den PR-Link und die Ergebnisse für AC-1 bis AC-4 als Abschlussnachweis aufbewahren. Danach die zugehörigen Classroom-Aufgaben selbst als erledigt markieren.
