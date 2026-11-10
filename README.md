# TDDS Thepha — พิมพ์เขียวระบบและคู่มือการใช้งาน
> **Thepha Dengue Disease Surveillance (TDDS) System**  
> ระบบสารสนเทศงานระบาดวิทยาโรคไข้เลือดออก อำเภอเทพา จังหวัดสงขลา (ครอบคลุม 7 ตำบล 15 หน่วยบริการ)

---

## 1. สถาปัตยกรรมระบบ (System Blueprint)

ระบบออกแบบเป็น **Single-Page Web Application** ที่ทำงานได้ทันทีผ่านเบราว์เซอร์ (รองรับ GitHub Pages) เชื่อมต่อฐานข้อมูลออนไลน์ **Supabase (PostgreSQL + PostgREST)** ร่วมกับ **IndexedDB / LocalStorage** บนอุปกรณ์ผู้ใช้งาน

### โครงสร้างไฟล์หลักของโปรเจกต์
| ไฟล์ | หน้าที่ / รายละเอียด |
|---|---|
| [webapp/index.html](file:///c:/Users/ACER/Desktop/TDDS/webapp/index.html) | ไฟล์หลักของเว็บแอปพลิเคชัน (UI + Logic ทั้งหมด) |
| [index.html](file:///c:/Users/ACER/Desktop/TDDS/index.html) | สำเนาซิงค์สำหรับ Deploy Root / GitHub Pages (SHA-256 ต้องตรงกับ `webapp/index.html`) |
| [webapp/tdds/index.html](file:///c:/Users/ACER/Desktop/TDDS/webapp/tdds/index.html) | สำเนาซิงค์สำหรับ Path `/tdds/` (SHA-256 ต้องตรงกับ `webapp/index.html`) |
| [create_person_table.sql](file:///c:/Users/ACER/Desktop/TDDS/create_person_table.sql) | สร้างตาราง `public.person`, Trigger คำนวณกลุ่มอายุ, Views และ Function ค้นหาบ้านรัศมี 100 ม. |
| [update_health_centers_hcode.sql](file:///c:/Users/ACER/Desktop/TDDS/update_health_centers_hcode.sql) | ผูกรหัสสถานพยาบาลมาตรฐาน 5 หลัก (`hcode`) ใน `health_centers` และทุกตารางที่เกี่ยวข้อง |
| [enable_current_dengue_cases_sync.sql](file:///c:/Users/ACER/Desktop/TDDS/enable_current_dengue_cases_sync.sql) | เปิดสิทธิ์ `INSERT/UPDATE/DELETE/SELECT` บนตาราง `public.current_dengue_cases` สำหรับหน้าเว็บ |
| [enable_staff_registration_sync.sql](file:///c:/Users/ACER/Desktop/TDDS/enable_staff_registration_sync.sql) | เปิดสิทธิ์ซิงค์และสมัครใช้งานบนตาราง `public.staff_accounts` |
| [create_accounts_table.sql](file:///c:/Users/ACER/Desktop/TDDS/create_accounts_table.sql) | สร้างตาราง `public.staff_accounts` และนำเข้าบัญชีเจ้าหน้าที่ตั้งต้น |
| [add_osm_village_rbac.sql](file:///c:/Users/ACER/Desktop/TDDS/add_osm_village_rbac.sql) | เพิ่มฟิลด์ `village_no`, `subdistrict` และสิทธิ์ อสม. รายหมู่บ้าน |
| [import_current_dengue_cases.sql](file:///c:/Users/ACER/Desktop/TDDS/import_current_dengue_cases.sql) | โครงสร้างและข้อมูลผู้ป่วยปี 2569 (`public.current_dengue_cases`) |
| [import_historical_dengue_5y.sql](file:///c:/Users/ACER/Desktop/TDDS/import_historical_dengue_5y.sql) | ข้อมูลระบาดย้อนหลัง 5 ปีสำหรับเปรียบเทียบค่ามัธยฐาน |
| [setup_daily_telegram_cron.sql](file:///c:/Users/ACER/Desktop/TDDS/setup_daily_telegram_cron.sql) | Cron ส่งสรุปรายงานประจำวันเวลา 15:00 น. ผ่าน Telegram |
| [setup_unconfirmed_cases_3hours_cron.sql](file:///c:/Users/ACER/Desktop/TDDS/setup_unconfirmed_cases_3hours_cron.sql) | Cron แจ้งเตือนเคสใหม่ที่ยังไม่ยืนยันเกิน 3 ชั่วโมง |

### เทคโนโลยีที่ใช้ (Frontend & Libraries)
- **UI & Styling**: Tailwind CSS (CDN), Google Fonts (`Kanit`, `Sarabun`), SweetAlert2
- **Charts & Maps**: Chart.js, Leaflet.js + **Google Maps Tiles** (Satellite Hybrid `lyrs=y`, Roadmap `lyrs=m`, Terrain `lyrs=p`)
- **Excel & PDF Export**: SheetJS (`xlsx@0.18.5`) สำหรับนำเข้า `.xls`/`.xlsx`, `html2canvas` + `jsPDF` (`html2pdf.bundle.min.js`) สำหรับสร้างไฟล์ `.pdf` แบบ A4
- **Client Storage**: `IndexedDB` (`TDDS_PersonDB`) สำหรับเก็บข้อมูลประชากร `person` จำนวนมาก และ `localStorage` สำหรับ Session/Cache

---

## 2. ตารางรหัสสถานพยาบาลมาตรฐาน (`hcode`)

ทุกตารางและรายงานในระบบเชื่อมโยงหน่วยบริการด้วยรหัส `hcode` 5 หลักเพื่อความถูกต้องตรงกัน:

| `hcode` | ชื่อหน่วยบริการ (`hname`) | ตำบล | โซน | ประชากรตั้งต้น |
|---|---|---|---|---|
| `09491` | รพ.สต.ตูหยง | ปากบาง | ทานตะวัน | 4,148 |
| `09492` | รพ.สต.ตาแปด | ตาแปด | ทานตะวัน | 3,119 |
| `09493` | รพ.สต.เกาะสะบ้า | เกาะสะบ้า | บานชื่น | 5,628 |
| `09494` | รพ.สต.ลำไพล | ลำไพล | ชวนชม | 9,742 |
| `09495` | รพ.สต.ท่าไทร | ลำไพล | ชวนชม | 3,941 |
| `09496` | รพ.สต.ท่าม่วง | ท่าม่วง | ทานตะวัน | 4,815 |
| `09497` | รพ.สต.พรุชิง | ท่าม่วง | ทานตะวัน | 5,032 |
| `09498` | รพ.สต.วังใหญ่ | วังใหญ่ | ชวนชม | 7,145 |
| `09499` | รพ.สต.สะกอม | สะกอม | บานชื่น | 4,689 |
| `09500` | รพ.สต.ท่าแมงลัก | สะกอม | บานชื่น | 2,544 |
| `11915` | รพ.สต.ทุ่งโดน | ท่าม่วง | ทานตะวัน | 3,456 |
| `15109` | PCU1 | เทพา | บานชื่น | 7,279 |
| `15107` | PCU2 | ปากบาง | ทานตะวัน | 4,222 |
| `00860` | สสอ.เทพา | เทพา | ศูนย์ประสานงาน | - |
| `11390` | รพ.เทพา | เทพา | ศูนย์ประสานงาน | - |

---

## 3. โมดูลหลักและคู่มือการใช้งาน

### 3.1 หน้า Dashboard ภาพรวม และรายงานสถานการณ์
- **ไม่รวมเคส `R/O` (`R/O DF`, `R/O DHF`)** ในการประมวลผลรายงานและตัวเลข KPI หน้า Dashboard, แผนที่เต็มจอ และรายงานสรุป Telegram/PDF (ประมวลผลเฉพาะผู้ป่วยยืนยัน `DF`, `DHF`, `DSS`)
- **ตัวชี้วัด KPI**: ผู้ป่วยสะสม, รายใหม่วันนี้, ป่วยภายใน 14 วัน (🔴 ระบาดด่วน), ป่วยภายใน 28 วัน (🟢 วงรอบควบคุมโรค), อัตราป่วยต่อแสนประชากร
- **กราฟวิเคราะห์**:
  - แนวโน้มรายเดือนปี 2569 เทียบปี 2568 และ Median 5 ปี (2564–2568)
  - **อัตราป่วยต่อแสนประชากร จำแนกตามกลุ่มอายุ (9 กลุ่ม)** คำนวณจากฐานข้อมูล `person` ที่นำเข้า (ต่อประชากร 100,000 คนในแต่ละกลุ่มอายุ)
  - กราฟสัดส่วนอาชีพ และกราฟโดนัท Diagnosis (`DF`, `DHF`, `DSS`)
- **แผนที่ Google Maps ภาพถ่ายดาวเทียม** และตารางสรุปตัวเลข 7 ตำบล / 13 หน่วยบริการปฐมภูมิ

### 3.2 หน้าทะเบียนข้อมูลผู้ป่วย (Patient Registry)
- **แสดงเคสทั้งหมดรวม `R/O`** เพื่อให้เจ้าหน้าที่ใช้ติดตามผล LAB และลงควบคุมโรคได้ครบถ้วน เรียงลำดับจาก **วันที่ใหม่ → เก่า**
- **ตัวกรองข้อมูล**: ค้นหาชื่อ/บ้านเลขที่/เบอร์โทร, เลือกสถานพยาบาล (`hcode`), ตำบล, หมู่ที่, ช่วงวันที่แจ้ง, เลือกการวินิจฉัยได้หลายตัวเลือก (Multi-select + Quick Chips), ระยะเฝ้าระวัง, สถานะยืนยันเคส
- **บันทึกและแก้ไขผู้ป่วย (6 ส่วน)**:
  - ซิงค์ข้อมูลเข้าตาราง `public.current_dengue_cases` บน Supabase อัตโนมัติ (เมื่อเพิ่ม/แก้ไข/ยืนยันเคส/ลบ)
  - มีปุ่ม **`🏘️ ดึงจาก person`** ในส่วนที่ 2 เพื่อค้นหาและดึงพิกัดบ้าน (`lat`, `lng`) จากฐานข้อมูลประชากร `person` ได้ทันที
- **ส่งออกทะเบียนผู้ป่วยเป็นไฟล์ CSV (`📥 ส่งออก CSV`)**:
  - เข้ารหัส UTF-8 BOM เปิดใน Excel ได้ทันที
  - **จำกัดสิทธิ์ตามสถานพยาบาล** (รพ.สต./PCU ส่งออกได้เฉพาะหน่วยบริการตนเอง, อสม. เฉพาะหน่วยบริการและหมู่ที่รับผิดชอบ, Admin/สสอ./รพ.เทพา ดูและส่งออกได้ทั้งหมด)
- **ดาวน์โหลดแบบสอบสวนโรค `.PDF` / พิมพ์รายงาน**:
  - สร้าง PDF ขนาด A4 ผ่าน `renderHtmlToPdfDirect` (`html2canvas + jsPDF`) พร้อมดูรายชื่อบ้านรอบรัศมี 100 เมตรภายในหน้าต่างรายละเอียดผู้ป่วย

### 3.3 ฐานข้อมูลประชากร (`person`) และค้นหาบ้านรัศมี 100 เมตร
- **เมนูนำเข้าข้อมูล (Admin Only → `🏘️ นำเข้าข้อมูลประชากร (person)`)**:
  - รองรับไฟล์ Excel JHCIS (`.xls`, `.xlsx`, `.csv`) โครงสร้าง 17 คอลัมน์ (เช่น `data_dengue11915.xls`)
  - ตรวจสลับคอลัมน์ `ละติจูด/ลองจิจูด` ให้อัตโนมัติ (กรณีไฟล์ JHCIS ส่งลองจิจูด `100.x` มาก่อนละติจูด `6.x`)
  - แปลงวันเกิด พ.ศ. → ค.ศ., คำนวณอายุและกลุ่มอายุ, บันทึกเข้า `IndexedDB` และซิงค์ Upsert ขึ้นตาราง `public.person` บน Supabase
- **เมนูค้นหาบ้านรัศมี 100 เมตร (`🎯 ค้นหาบ้านรัศมี 100 เมตร` — ผู้ใช้ที่เข้าสู่ระบบทุกคน)**:
  - แสดงผลบนแผนที่ **Google Maps ภาพถ่ายดาวเทียม (Satellite Hybrid)** พร้อมสลับแผนที่ถนนได้
  - เลือกจุดศูนย์กลางได้ทั้งจาก **รายชื่อผู้ป่วยในเขตรับผิดชอบ** (รวมเคส `R/O`), **พิมพ์ค้นหาบ้าน/บุคคลจากตาราง `person`**, หรือ **กรอกพิกัด Lat/Lng เอง**
  - **จำกัดสิทธิ์การเข้าถึงข้อมูล `person` ([`getFilteredPersonsForUser`](file:///c:/Users/ACER/Desktop/TDDS/webapp/index.html#L18162-L18193))**:
    - **Admin**: ดูและค้นหาได้ทั้งหมดทุกหน่วยบริการ
    - **เจ้าหน้าที่ รพ.สต./PCU**: ดูเฉพาะ `person` ที่ `pcucodeperson` ตรงกับ `hcode` ของตน
    - **อสม.**: ดูเฉพาะ `person` ในหน่วยบริการตนเองและตรงกับชื่อ `osm_name` / `village_no` ที่รับผิดชอบ
  - สรุปจำนวนหลังคาเรือน/ประชากรในรัศมี และดาวน์โหลดรายชื่อบ้านเป็นไฟล์ **CSV** สำหรับทีมพ่นหมอกควัน

### 3.4 ระบบเข้าสู่ระบบ, สมัครเข้าใช้งาน และสิทธิ์การใช้งาน (Auth & RBAC)
- **หน้าต่างเข้าสู่ระบบ & สมัครเข้าใช้งาน ([`loginModal`](file:///c:/Users/ACER/Desktop/TDDS/webapp/index.html#L1436-L1649))**:
  - รองรับแสดง/ซ่อนรหัสผ่าน (ไม่มีปุ่มเข้าสู่ระบบด่วนเพื่อความปลอดภัย)
  - แท็บ **สมัครเข้าใช้งาน** ครบช่อง: `Username`, `Password`, `ชื่อ-สกุล`, `ตำแหน่ง` (6 ตำแหน่งมาตรฐาน), `หน่วยบริการ`, `ตำบล`, `หมู่ที่ (1–14)`, `สิทธิ์การใช้งาน` (`staff`, `OSM`, `admin`)
- **ขั้นตอนอนุมัติผู้ใช้งาน (Admin Approval Workflow)**:
  1. บัญชีที่สมัครใหม่จะมีสถานะ **`Pending Approval`** (`is_active = false`) และยังไม่สามารถเข้าสู่ระบบได้จนกว่าจะได้รับอนุมัติ
  2. ผู้ดูแลระบบ (Admin) เข้าเมนู **`👥 จัดการผู้ใช้งาน`** จะเห็นป้ายแจ้งจำนวนรออนุมัติ (`⏳ รออนุมัติ`) และปุ่ม **`✅ อนุมัติ`** / **`❌ ไม่อนุมัติ`** ด้านบนสุดของตาราง
  3. เมื่อ Admin กดอนุมัติ ระบบจะอัปเดตสถานะเป็น `Active` ทั้งในเครื่องและตาราง `public.staff_accounts` บน Supabase ทันที

---

## 4. คู่มือติดตั้ง/ตั้งค่า Supabase และ Checklist สำหรับผู้ดูแลระบบ

### 4.1 การเชื่อมต่อ Supabase ปัจจุบัน
- หน้าเว็บกำหนดค่าเริ่มต้นเชื่อมต่อกับโปรเจกต์ Supabase (`https://zgvtfzjjjzywiqbiudtn.supabase.co`) โดยใช้ **Publishable Key** ผ่าน header `apikey`
- สคริปต์ SQL ที่ต้องรันใน **Supabase SQL Editor** (กรณีตั้งค่าครั้งแรกหรือยังไม่เคยรัน):
  1. [update_health_centers_hcode.sql](file:///c:/Users/ACER/Desktop/TDDS/update_health_centers_hcode.sql) — เชื่อมรหัส `hcode` 5 หลัก
  2. [create_person_table.sql](file:///c:/Users/ACER/Desktop/TDDS/create_person_table.sql) — สร้างตาราง `public.person` + Views + ฟังก์ชันค้นหารัศมี 100 ม.
  3. [enable_current_dengue_cases_sync.sql](file:///c:/Users/ACER/Desktop/TDDS/enable_current_dengue_cases_sync.sql) — เปิดสิทธิ์บันทึก/แก้ไข/ลบผู้ป่วยบน `public.current_dengue_cases`
  4. [enable_staff_registration_sync.sql](file:///c:/Users/ACER/Desktop/TDDS/enable_staff_registration_sync.sql) — เปิดสิทธิ์สมัครสมาชิกและอนุมัติผู้ใช้บน `public.staff_accounts`

### 4.2 ข้อกำหนดการบำรุงรักษาโค้ด (Maintenance Checklist)
1. ทุกครั้งที่แก้ไข [webapp/index.html](file:///c:/Users/ACER/Desktop/TDDS/webapp/index.html) **ต้องซิงค์ไฟล์** ให้ตรงกันทั้ง 3 ตำแหน่ง (ตรวจด้วย SHA-256 ให้ตรงกัน):
   - `webapp/index.html`
   - `index.html`
   - `webapp/tdds/index.html`
2. ตรวจสอบความสมดุลของวงเล็บ JS (`{ }`, `[ ]`, `( )`) ในทุกแท็ก `<script>` หลังแก้ไขทุกครั้ง
3. รักษาข้อความ Footer มาตรฐาน: `@ 2026|ระบบสารสนเทศงานระบาดอำเภอเทพา จังหวัดสงขลา`

---
`@ 2026|ระบบสารสนเทศงานระบาดอำเภอเทพา จังหวัดสงขลา`
