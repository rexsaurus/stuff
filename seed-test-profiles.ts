/**
 * Seed `provider_listings` + `auth_accounts` from `scripts/manifest.json`
 * (synthetic faces). Intended for **test** databases only.
 *
 * **Standalone:** only `node:fs`, `node:path`, `node:crypto`, and `pg` — no `src/` or `server/` imports
 * (Docker image may omit those trees). Run from `web/`:
 *
 *   MANIFEST_PATH=./scripts/manifest.json IMAGE_BASE_URL=https://media.savor.love/savor-test \
 *     npx tsx scripts/seed-test-profiles.ts
 *
 * Env resolution: `SAVORLOVE_TEST_DATABASE_URL` → `DATABASE_TEST_URL` → `DATABASE_URL` → built-in default.
 * Loads `.env`, `.env.test`, `.env.test.local`, and cherry-picks `DATABASE_TEST_URL` / `SAVORLOVE_TEST_DATABASE_URL` from `.env.local`.
 *
 * **Password:** `password_hash` is SHA-256 hex of `SeedTest!00` (not bcrypt). App login expects bcrypt — use this seed for
 * listings/tests only, or re-hash in a full environment if you need provider sign-in.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { Pool } from 'pg'

const DEFAULT_DB =
  'postgres://postgres:pqt3gB7f2KBpmWbJVzTmi2XcOv35grRdPemJZn6aBBFfmYCsKa2Zhrg518Nmrd4g@syyujkrshu3ubrz0qg8nzh67:5432/savorlove_test'

function hashPassword(p: string): string {
  return createHash('sha256').update(p, 'utf8').digest('hex')
}

const BODY_TYPES = ['Slim', 'Athletic', 'Curvy', 'BBW', 'Average', 'Petite'] as const
const SERVICES = ['GFE', 'Massage', 'Dinner Date', 'Overnight', 'Touring', 'Couples', 'BDSM', 'Fetish'] as const

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randBool(pct = 50): boolean {
  return Math.random() * 100 < pct
}

const BIO_TEMPLATES: ((name: string, city: string) => string)[] = [
  (name, city) =>
    `Hi, I'm ${name}, based in beautiful ${city}. I'm known for being warm, genuine, and attentive. I see a limited number of clients by appointment only.`,
  (name, city) =>
    `${name} here — ${city}'s open secret. Sophisticated, discreet, and unforgettable. Let's connect and see if we're a good fit.`,
  (name, city) =>
    `Independent provider based in ${city}. I prioritize quality over quantity and only meet with respectful, vetted gentlemen.`,
  (name, city) =>
    `Hello from ${city}! I'm ${name}, and I love meeting interesting people. Genuine chemistry is everything to me — reach out and let's chat.`,
  (name, city) =>
    `${city}-based, ${name}. I'm the girl next door with a wild side. Discreet, professional, always on time.`,
]

function fakeProviderBio(name: string, city: string): string {
  return rand(BIO_TEMPLATES)(name, city)
}

function parseEnvLines(text: string, into: Record<string, string>): void {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    into[key] = val
  }
}

function loadScriptEnv(): void {
  const root = process.cwd()
  const mergeFile = (rel: string, override: boolean) => {
    const full = join(root, rel)
    if (!existsSync(full)) return
    const parsed: Record<string, string> = {}
    parseEnvLines(readFileSync(full, 'utf8'), parsed)
    for (const [k, v] of Object.entries(parsed)) {
      if (!v.trim()) continue
      if (override || !process.env[k]?.trim()) process.env[k] = v
    }
  }
  mergeFile('.env', false)
  mergeFile('.env.test', true)
  mergeFile('.env.test.local', true)
  const envLocal = join(root, '.env.local')
  if (existsSync(envLocal)) {
    const parsed: Record<string, string> = {}
    parseEnvLines(readFileSync(envLocal, 'utf8'), parsed)
    for (const key of ['DATABASE_TEST_URL', 'SAVORLOVE_TEST_DATABASE_URL'] as const) {
      if (process.env[key]?.trim()) continue
      const v = parsed[key]
      if (typeof v === 'string' && v.trim()) process.env[key] = v
    }
  }
}

function postgresDatabaseNameFromUrl(connectionString: string): string | null {
  const t = connectionString.trim()
  const noQuery = t.split('?')[0] ?? t
  const slash = noQuery.lastIndexOf('/')
  if (slash < 0 || slash >= noQuery.length - 1) return null
  const name = noQuery.slice(slash + 1).trim()
  return name || null
}

function assertPostgresUrlDatabaseNameContainsTest(url: string): void {
  const name = postgresDatabaseNameFromUrl(url)
  if (!name || !/test/i.test(name)) {
    console.error(
      'ERROR: resolved database URL must use a database name containing "test" (case-insensitive). Aborting.',
    )
    process.exit(1)
  }
}

function resolveDatabaseUrl(): string {
  const url = (
    process.env.SAVORLOVE_TEST_DATABASE_URL?.trim() ||
    process.env.DATABASE_TEST_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    DEFAULT_DB
  ).trim()
  assertPostgresUrlDatabaseNameContainsTest(url)
  return url
}

const BUST_SIZES = ['Small', 'Medium', 'Large', 'Very Large', 'Extra Large'] as const
const HEIGHT_POOL = [
  "5'0\"",
  "5'1\"",
  "5'2\"",
  "5'3\"",
  "5'4\"",
  "5'5\"",
  "5'6\"",
  "5'7\"",
  "5'8\"",
  "5'9\"",
  "5'10\"",
  "5'11\"",
]
const EYE_COLOURS = ['Blue', 'Brown', 'Green', 'Hazel', 'Gray']

const CITIES = [
  { city: 'Seattle', state: 'WA', weight: 28 },
  { city: 'Bellevue', state: 'WA', weight: 14 },
  { city: 'Tacoma', state: 'WA', weight: 13 },
  { city: 'Everett', state: 'WA', weight: 9 },
  { city: 'Kirkland', state: 'WA', weight: 8 },
  { city: 'Renton', state: 'WA', weight: 7 },
  { city: 'Lynnwood', state: 'WA', weight: 6 },
  { city: 'Olympia', state: 'WA', weight: 6 },
  { city: 'Bellingham', state: 'WA', weight: 4 },
  { city: 'SeaTac', state: 'WA', weight: 3 },
  { city: 'Woodinville', state: 'WA', weight: 2 },
] as const

const SEED_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Seattle: { lat: 47.6062, lng: -122.3321 },
  Bellevue: { lat: 47.6101, lng: -122.2015 },
  Tacoma: { lat: 47.2529, lng: -122.4443 },
  Everett: { lat: 47.9789, lng: -122.2021 },
  Kirkland: { lat: 47.6815, lng: -122.2087 },
  Renton: { lat: 47.4829, lng: -122.2171 },
  Lynnwood: { lat: 47.8279, lng: -122.3053 },
  Olympia: { lat: 47.0379, lng: -122.9007 },
  Bellingham: { lat: 48.7519, lng: -122.4787 },
  SeaTac: { lat: 47.448, lng: -122.2929 },
  Woodinville: { lat: 47.7543, lng: -122.1639 },
}

function placeIdForSeedCity(city: string): string {
  return (
    city
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '') || 'unknown'
  )
}

function latLngForSeedCity(city: string): { lat: number; lng: number } {
  return SEED_CITY_COORDS[city] ?? SEED_CITY_COORDS.Seattle!
}

type ManifestPhoto = {
  url: string
  orientation?: string
  width?: number
  height?: number
  photo_num?: number
}

type ManifestPerson = {
  person_id: string
  name: string
  identity: {
    age?: string
    hair?: string
    skin?: string
    clothes?: string
    name?: string
  }
  photos: ManifestPhoto[]
}

function assertServerDatabaseNameIsTest(dbName: string): void {
  if (!/test/i.test(dbName)) {
    console.error(`ERROR: current_database()="${dbName}" is not a test database. Aborting.`)
    process.exit(1)
  }
}

export function parseAge(s: string | undefined): string {
  if (!s) return String(randInt(22, 38))
  const m = s.match(/(\d{1,2})\s*year/i)
  return m?.[1] ?? String(randInt(22, 38))
}

export function parseHairColour(hair: string | undefined): string {
  if (!hair) return 'brunette'
  const t = hair.toLowerCase()
  if (t.includes('blond')) return 'blonde'
  if (t.includes('brown')) return 'brunette'
  if (t.includes('black')) return 'black'
  if (t.includes('red') || t.includes('auburn')) return 'red'
  if (t.includes('gray') || t.includes('grey')) return 'gray'
  return 'brunette'
}

export function parseHairLength(hair: string | undefined): string {
  if (!hair) return 'medium'
  const t = hair.toLowerCase()
  if (t.includes('long')) return 'long'
  if (t.includes('short')) return 'short'
  if (t.includes('shoulder')) return 'shoulder-length'
  return 'medium'
}

export function parseSkinToEthnicity(skin: string | undefined): string {
  if (!skin) return 'Mixed'
  const t = skin.toLowerCase()
  if (t.includes('olive')) return 'latina'
  if (t.includes('fair') || t.includes('pale')) return 'White'
  if (t.includes('dark') || t.includes('deep')) return 'Black'
  if (t.includes('tan') || t.includes('medium')) return 'Mixed'
  return 'Mixed'
}

function weightedCityPick(): {
  city: string
  state: string
  lat: number
  lng: number
  placeId: string
} {
  const total = CITIES.reduce((s, c) => s + c.weight, 0)
  let r = Math.random() * total
  for (const c of CITIES) {
    r -= c.weight
    if (r <= 0) {
      const { lat, lng } = latLngForSeedCity(c.city)
      return { city: c.city, state: c.state, lat, lng, placeId: placeIdForSeedCity(c.city) }
    }
  }
  const last = CITIES[CITIES.length - 1]!
  const { lat, lng } = latLngForSeedCity(last.city)
  return { city: last.city, state: last.state, lat, lng, placeId: placeIdForSeedCity(last.city) }
}

function namebaseFromDisplayName(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
  return (s || 'provider').slice(0, 23)
}

function buildPhotoUrl(
  imageBaseUrl: string | undefined,
  personId: string,
  photoNum: number,
  manifestUrl: string,
): string {
  const b = imageBaseUrl?.trim()
  if (b) {
    const base = b.replace(/\/$/, '')
    return `${base}/${personId}/photo_${photoNum}.jpg`
  }
  return manifestUrl
}

/** Prefer `MANIFEST_PATH`, then `./scripts/manifest.json`, then `./manifest.json` (e.g. rexsaurus/stuff layout). */
function resolveManifestPath(): string {
  const envRel = process.env.MANIFEST_PATH?.trim()
  if (envRel) return isAbsolute(envRel) ? envRel : join(process.cwd(), envRel)
  const candidates = ['scripts/manifest.json', 'manifest.json']
  for (const rel of candidates) {
    const full = join(process.cwd(), rel)
    if (existsSync(full)) return full
  }
  return join(process.cwd(), 'scripts/manifest.json')
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

function pickAvailableDays(): string[] {
  const picked = WEEKDAYS.filter(() => randBool(52))
  if (picked.length >= 2) return [...picked]
  return ['Friday', 'Saturday', 'Sunday']
}

function pickAvailableTimes(): string[] {
  const pool = ['09:00-12:00', '12:00-16:00', '16:00-20:00', '20:00-23:00', 'By arrangement']
  const picked = pool.filter(() => randBool(48))
  return picked.length ? picked : ['12:00-20:00']
}

async function main(): Promise<void> {
  loadScriptEnv()
  const databaseUrl = resolveDatabaseUrl()

  const manifestPath = resolveManifestPath()

  const imageBase = process.env.IMAGE_BASE_URL?.trim()
  if (imageBase) {
    console.log(`[seed] IMAGE_BASE_URL → photo URLs like ${imageBase.replace(/\/$/, '')}/<person_id>/photo_<n>.jpg`)
  } else {
    console.warn('[seed] IMAGE_BASE_URL unset — using manifest `url` values for photos.')
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const cdb = await pool.query<{ current_database: string }>(
    `SELECT current_database() AS current_database`,
  )
  const dbName = cdb.rows[0]?.current_database ?? ''
  assertServerDatabaseNameIsTest(dbName)

  let rawJson: string
  try {
    rawJson = readFileSync(manifestPath, 'utf8')
  } catch (e) {
    console.error(`ERROR: Could not read manifest at ${manifestPath}`, e)
    process.exit(1)
  }

  const manifest = JSON.parse(rawJson) as ManifestPerson[]
  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.error('ERROR: manifest must be a non-empty array.')
    process.exit(1)
  }

  const passwordHash = hashPassword('SeedTest!00')
  const seededAt = new Date().toISOString()

  const maxR = await pool.query<{ m: number }>(`SELECT COALESCE(MAX(id), 0)::int AS m FROM provider_listings`)
  let nextId = (maxR.rows[0]?.m ?? 0) + 1

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (let index = 0; index < manifest.length; index++) {
      const person = manifest[index]!
      const listingId = nextId++
      const city = weightedCityPick()
      const hairStr = person.identity?.hair
      const skinStr = person.identity?.skin
      const ageStr = parseAge(person.identity?.age)
      const ageNum = parseInt(ageStr, 10) || randInt(22, 38)

      const handle = `seed_${namebaseFromDisplayName(person.name)}_${String(index).padStart(3, '0')}`
      const email = `${handle}@seed.test`
      const phone = `+1555000${100 + index}`

      const photoUrls: string[] = []
      const galleryPhotos = (person.photos ?? []).map((ph, j) => {
        const num = typeof ph.photo_num === 'number' ? ph.photo_num : j + 1
        const public_url = buildPhotoUrl(imageBase, person.person_id, num, ph.url)
        photoUrls.push(public_url)
        return {
          id: `${person.person_id}-p${num}`,
          public_url,
          is_avatar: j === 0,
          position: j,
          orientation: ph.orientation ?? null,
          width: ph.width ?? null,
          height: ph.height ?? null,
        }
      })

      const primaryPhoto = photoUrls[0] ?? ''

      const firstName = person.name.split(/\s+/)[0] ?? person.name
      const bioText = fakeProviderBio(firstName, city.city)
      const hourly = randInt(180, 520)
      const bodyType = rand(BODY_TYPES)
      const bustSize = rand(BUST_SIZES)
      const heightLabel = rand(HEIGHT_POOL)
      const eyeColour = rand(EYE_COLOURS)
      const servicesList = Array.from(new Set([rand(SERVICES), rand(SERVICES), rand(SERVICES)]))
      const availableToday = randBool(35)
      const shortNotice = randBool(42)
      const byAppointment = availableToday ? randBool(55) : true
      const availableDays = pickAvailableDays()
      const availableTimes = pickAvailableTimes()
      const ratingScore = Math.round((42 + Math.random() * 8) * 10) / 10
      const reviewCount = randInt(3, 52)

      const rates = {
        '1hour': hourly,
        '2hours': Math.max(hourly * 2 - randInt(20, 80), hourly + 40),
        '3hours': Math.round(hourly * 2.75),
        overnight: hourly * randInt(4, 7),
      }

      const rawData: Record<string, unknown> = {
        id: listingId,
        display_name: person.name,
        displayName: person.name,
        bio: bioText,
        description: bioText,
        city: city.city,
        state: city.state,
        lat: city.lat,
        lng: city.lng,
        place_id: city.placeId,
        placeId: city.placeId,
        place_name: city.city,
        placeName: city.city,
        phone,
        photos: photoUrls,
        cover_photo: primaryPhoto,
        coverPhoto: primaryPhoto,
        service: servicesList[0],
        services: servicesList,
        tags: `${parseHairColour(hairStr)} ${bodyType}`,
        hourly_rate: hourly,
        hourlyRate: hourly,
        rates,
        gender: 'Female',
        ethnicity: parseSkinToEthnicity(skinStr),
        hair_color: parseHairColour(hairStr),
        hairColor: parseHairColour(hairStr),
        hair_length: parseHairLength(hairStr),
        hairLength: parseHairLength(hairStr),
        age: ageNum,
        body_type: bodyType,
        bodyType,
        bust_size: bustSize,
        bustSize,
        height: heightLabel,
        eye_colour: eyeColour,
        eyeColour,
        photo_url: primaryPhoto,
        photoUrl: primaryPhoto,
        photo_data_uris: photoUrls,
        photoDataUris: photoUrls,
        gallery_photos: galleryPhotos,
        galleryPhotos,
        reviews: [],
        rating: ratingScore,
        rating_score: ratingScore,
        overall_rating: ratingScore,
        overallRating: ratingScore,
        review_count: reviewCount,
        reviewCount,
        available: availableToday,
        available_today: availableToday,
        availableToday,
        short_notice: shortNotice,
        shortNotice,
        by_appointment: byAppointment,
        byAppointment,
        available_days: availableDays,
        availableDays,
        available_times: availableTimes,
        availableTimes,
        is_seeded: true,
        seed_version: '1.0',
        seed_person_id: person.person_id,
        seeded_at: seededAt,
      }

      await client.query(`INSERT INTO provider_listings (id, raw_data) VALUES ($1, $2::jsonb)`, [listingId, rawData])

      await client.query(
        `INSERT INTO auth_accounts (
           email, password_hash, role, display_name, username, phone, service_city,
           email_verified_at, claimed_provider_listing_id, onboarding_step, onboarding_complete,
           provider_gender, provider_ethnicity, provider_hair_color, provider_hair_length,
           provider_height, provider_body_type, provider_bust
         ) VALUES (
           $1, $2, 'provider', $3, $4, $5, $6,
           NOW(), $7, 8, TRUE,
           'Female', $8, $9, $10,
           $11, $12, $13
         )`,
        [
          email,
          passwordHash,
          person.name,
          handle,
          phone,
          city.city,
          listingId,
          parseSkinToEthnicity(skinStr),
          parseHairColour(hairStr),
          parseHairLength(hairStr),
          heightLabel,
          bodyType,
          bustSize,
        ],
      )
    }

    await client.query('COMMIT')
    console.log(`Seeded ${manifest.length} provider listing(s) + auth_accounts from ${manifestPath}`)
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
