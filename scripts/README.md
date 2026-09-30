# Öffentliche Aktivität

Die Grafik wird hier im Repository erzeugt. Sie benötigt keinen externen Statistik-Dienst, kein Tracking und kein zusätzliches Secret.

## Datenquelle

- Unauthentifizierte GitHub REST API: öffentliche, eigene Repositories von `Stxqq`, ohne Forks.
- Commits aus dem jeweiligen Standard-Branch, Autorenzuordnung über `author.login`.
- 365 Kalendertage einschließlich heute; Tage und Commit-Autorenzeitstempel in UTC.
- Gleiche Commit-SHAs werden nur einmal gezählt.
- Der automatische Commit `chore: refresh public profile activity [skip ci]` wird ausgeschlossen.
- Farben entsprechen 0, 1–2, 3–5, 6–9 und mindestens 10 Commits pro Tag.

Das ist eine **Commit-Heatmap**, kein Nachbau des vollständigen GitHub-Contribution-Graphs: Issues, Pull Requests, fremde Repositories, andere Branches und private Aktivität sind nicht enthalten. Wenige gefüllte Felder sind deshalb normal. Die Privatsphäre-Einstellungen des Profils werden nicht geändert.

## Aktualisierung

Der Workflow läuft täglich um 05:17 UTC, nach einem Push auf `main` und bei manueller Auslösung. GitHub kann geplante Läufe verzögert ausführen. Der angezeigte Stand ist das Datum der letzten erfolgreichen Datenerhebung.

API-Fehler oder unvollständige Antworten brechen die Aktualisierung ab; die zuletzt erfolgreiche Grafik bleibt erhalten. Der Generator liest ohne Token, der Workflow verwendet seine Schreibberechtigung ausschließlich zum Speichern der Grafik. Automatische Commits werden Stefan zugeordnet. Ein konkurrierender Push wird nicht überschrieben: In diesem Fall schlägt der Push sicher fehl und der nächste Lauf aktualisiert die Karte.

```sh
node --test scripts/update-activity.test.mjs
node scripts/update-activity.mjs
```

Manuell auf GitHub: **Actions → Öffentliche Profil-Aktivität → Run workflow**. Bei längerer Inaktivität kann GitHub geplante Workflows in öffentlichen Repositories deaktivieren; sie lassen sich dort wieder aktivieren.

## Portfolio-Vorschau

`assets/portfolio-preview.png` ist ein echter Screenshot des lokalen Portfolios, keine öffentlich bereitgestellte Website. Sobald eine öffentliche Adresse existiert, können Bild und Link in der Profil-README aktualisiert werden.

Referenzen: [GitHub REST: Commits](https://docs.github.com/en/rest/commits/commits#list-commits), [GitHub Actions: geplante Workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
