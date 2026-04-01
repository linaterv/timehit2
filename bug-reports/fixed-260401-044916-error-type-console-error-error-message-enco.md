# Bug: ## Error Type
Console Error

## Error Message
Encountered two children with the same key, `DK`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.


    at option (<anonymous>:null:null)
    at <unknown> (components/shared/country-select.tsx:62:9)
    at Array.map (<anonymous>:null:null)
    at CountrySelect (components/shared/country-select.tsx:61:18)
    at ContractorDetailPage (app/(authenticated)/contractors/[id]/page.tsx:390:13)

## Code Frame
  60 |       <option value="">Select country...</option>
  61 |       {COUNTRIES.map((c) => (
> 62 |         <option key={c.code} value={c.code}>
     |         ^
  63 |           {c.code} — {c.name}
  64 |         </option>
  65 |       ))}

Next.js version: 16.2.1 (Turbopack)

- **Page:** /contractors/5b775fc4-1f0c-4488-a2c0-be740ae3c40c
- **User:** admin2@timehit.com (ADMIN)
- **Browser:** Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
- **Time:** 2026-04-01T04:49:16.413Z

## Page Context
- **Page Heading:** ALEXAlex Turner
- **Detail Header:** ALEXAlex Turner | Company Info | VAT | Bank | Invoice Settings

## Description
## Error Type
Console Error

## Error Message
Encountered two children with the same key, `DK`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.


    at option (<anonymous>:null:null)
    at <unknown> (components/shared/country-select.tsx:62:9)
    at Array.map (<anonymous>:null:null)
    at CountrySelect (components/shared/country-select.tsx:61:18)
    at ContractorDetailPage (app/(authenticated)/contractors/[id]/page.tsx:390:13)

## Code Frame
  60 |       <option value="">Select country...</option>
  61 |       {COUNTRIES.map((c) => (
> 62 |         <option key={c.code} value={c.code}>
     |         ^
  63 |           {c.code} — {c.name}
  64 |         </option>
  65 |       ))}

Next.js version: 16.2.1 (Turbopack)
