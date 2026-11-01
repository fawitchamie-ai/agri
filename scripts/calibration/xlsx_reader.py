"""Read cached values from OOXML without executing formulas or requiring Excel.
Original workbook bytes are checksum-verified by the importer. No authoring.
"""
from pathlib import PurePosixPath
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
BUILTIN_DATES = set(range(14, 23)) | set(range(45, 48))

class Workbook:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        if sum(i.file_size for i in self.z.infolist()) > 512_000_000:
            raise ValueError('Workbook expansion exceeds the import budget')
        if any('..' in PurePosixPath(i.filename).parts for i in self.z.infolist()):
            raise ValueError('Invalid workbook path')
        self.strings = []
        if 'xl/sharedStrings.xml' in self.z.namelist():
            for _, e in ET.iterparse(self.z.open('xl/sharedStrings.xml'), events=('end',)):
                if e.tag.endswith('}si'):
                    self.strings.append(''.join(t.text or '' for t in e.iter() if t.tag.endswith('}t')))
                    e.clear()
        styles = ET.fromstring(self.z.read('xl/styles.xml'))
        custom = {int(x.attrib['numFmtId']): x.attrib['formatCode'] for x in styles.findall('m:numFmts/m:numFmt', NS)}
        self.date_styles = set()
        for i, x in enumerate(styles.findall('m:cellXfs/m:xf', NS)):
            n = int(x.attrib.get('numFmtId', 0))
            pattern = re.sub(r'"[^"]*"|\[[^\]]*\]|\\.', '', custom.get(n, ''))
            if n in BUILTIN_DATES or re.search('[dy]', pattern, re.I):
                self.date_styles.add(i)
        rels = ET.fromstring(self.z.read('xl/_rels/workbook.xml.rels'))
        targets = {x.attrib['Id']: x.attrib['Target'] for x in rels}
        root = ET.fromstring(self.z.read('xl/workbook.xml'))
        self.epoch = datetime(1904, 1, 1) if root.find('m:workbookPr', NS) is not None and root.find('m:workbookPr', NS).attrib.get('date1904') == '1' else datetime(1899, 12, 30)
        self.sheets = {}
        for s in root.findall('m:sheets/m:sheet', NS):
            target = targets[s.attrib[REL]]
            self.sheets[s.attrib['name']] = target.lstrip('/') if target.startswith('/') else str(PurePosixPath('xl') / target)

    def rows(self, sheet):
        for _, e in ET.iterparse(self.z.open(self.sheets[sheet]), events=('end',)):
            if e.tag != '{'+NS['m']+'}row':
                continue
            out = []
            for c in e.findall('m:c', NS):
                col = 0
                for char in re.sub('[0-9]', '', c.attrib['r']):
                    col = col * 26 + ord(char) - 64
                while len(out) < col:
                    out.append(None)
                v = c.find('m:v', NS)
                raw = v.text if v is not None else None
                kind = c.attrib.get('t')
                if kind == 's' and raw is not None:
                    value = self.strings[int(raw)]
                elif kind == 'inlineStr':
                    value = ''.join(x.text or '' for x in c.findall('.//m:t', NS))
                elif kind == 'b' and raw is not None:
                    value = raw == '1'
                elif raw is None:
                    value = None
                elif kind in ('str', 'e'):
                    value = raw
                else:
                    value = float(raw)
                    if int(c.attrib.get('s', -1)) in self.date_styles:
                        value = (self.epoch + timedelta(days=value)).isoformat().split('T')[0]
                    elif value.is_integer():
                        value = int(value)
                out[col-1] = value
            row_num = int(e.attrib['r'])
            e.clear()
            if any(v is not None and v != '' for v in out):
                yield row_num, out

    def records(self, sheet):
        rows = iter(self.rows(sheet))
        _, header = next(rows)
        names = [str(h).strip() if h is not None else f'_column_{i+1}' for i, h in enumerate(header)]
        if len(names) != len(set(names)):
            raise ValueError('Ambiguous duplicate headers in '+sheet)
        for n, values in rows:
            yield n, dict(zip(names, values + [None]*max(0, len(names)-len(values))))

    def close(self):
        self.z.close()

    def metadata_dictionary(self, sheet='README'):
        """Expand explicitly merged README cells only, never measurement blanks."""
        grid = {(r, c+1): value for r, values in self.rows(sheet) for c, value in enumerate(values)}
        origins = {}
        def position(ref):
            match = re.fullmatch(r'([A-Z]+)([0-9]+)', ref)
            col=0
            for char in match[1]:col=col*26+ord(char)-64
            return int(match[2]),col
        root=ET.fromstring(self.z.read(self.sheets[sheet]))
        for merge in root.findall('m:mergeCells/m:mergeCell', NS):
            first,last=merge.attrib['ref'].split(':');r0,c0=position(first);r1,c1=position(last)
            if (r1-r0+1)*(c1-c0+1)>1000:raise ValueError('Oversized README merge')
            for r in range(r0,r1+1):
                for c in range(c0,c1+1):
                    if grid.get((r,c)) is None:grid[(r,c)]=grid.get((r0,c0));origins[(r,c)]=merge.attrib['ref']
        out={}
        for r in sorted({p[0] for p in grid}):
            name=grid.get((r,2))
            if isinstance(name,str) and name and not name.startswith(('SHEET','Column')):
                out[name.strip()]={'method':grid.get((r,3)),'unit':grid.get((r,4)),'metadata_row':r,'explicit_merged_method':origins.get((r,3)),'explicit_merged_unit':origins.get((r,4))}
        return out
