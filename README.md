## Code zum Forschungsprojekt:

## Analyse rechter Strukturen in sozialen Medien

---

Vorliegend ist der Quellcode des Programmes, das zur Datenerhebung des Forschungsprojektes verwendet wurde.

Dieses Programm ist funktionsfähig, aber nicht komplett fertig gestellt. Diese Dokumentation ist ebenso noch nicht vollständig. Da das Forschungsprojekt abgeschlossen wurde, ist es unwahrscheinlich, dass dieses Programm in naher Zukunft noch erweitert wird.

---

## Wie funktioniert das Programm?

Vorausgewählte Accounts werden in einer Liste in [accounts.js](https://github.com/ArtInLines/social-media-data/blob/master/accounts.js) gespeichert. Über jeden dieser Accounts wird dann iterariert, um
Daten von Twitter bzw. Instagram zu bekommen und User-Objekte zu erstellen. Die Verbindung zu anderen User-Objekten wird dabei gespeichert, um am Ende ein Netzwerk programmatisch zu erstellen.

Als Grundlage der Datenspeicherung werden sowohl Erkenntnisse aus der [Netzwerkforschung](https://de.wikipedia.org/wiki/Netzwerkforschung 'Wikipedia: Netzwerkforschung') sowie der
[Graphentheorie](https://de.wikipedia.org/wiki/Graphentheorie 'Wikipedia: Graphentheorie') genutzt.

Bei **Twitter** funktioniert die Datenerhebung über die privat nutzbare **Twitter API v.1.1**. Die Daten werden von Twitter angefordert und dann programmatisch kategorisiert und gespeichert. Eine
genauere Beschreibung des Vorgangs finden Sie weiter unten.

Bei **Instagram** existiert keine öffentliche API, die zur Datenerhebung genutzt werden könnte. Das Sammeln von Daten über Instagram ist dementsprechend nur über so-genanntes `Web-Scraping` möglich.
Eine genauere Beschreibung und eine Erklärung von `Web-Scraping` finden Sie ebenfalls weiter unten.

Erklärungen des Punketsystems und des inneren/äußeren Kreises werden bald hinzugefügt.

Das Ergebnis des Forschungsprojektes wird zwei Datensätze enthalten, die Unterschiede bzw. Gemeinsamkeiten der Burschenschaften auf unterschiedlichen sozialen Netzwerken zeigen. Es kann nicht auf
einen Datensatz gekürzt werden, da zwei Soziale Medien betrachtet werden, deren Accounts nicht übertragbar sind.

---

## Twitter

Twitters API bietet Daten zu einzelnen Nutzern, deren zugehörigen "Tweets" (wobei nur die neuesten ~3500 von Twitter weitergegeben werden), deren Freunde, deren Followers, sowie deren ge-likte Tweets.
D

---

## Instagram

Die Beschreibung der Datenerhebung bei Twitter wird bald hinzugefügt.
