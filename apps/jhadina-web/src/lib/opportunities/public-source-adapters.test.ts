import { describe,expect,it } from 'vitest'
import {
  LA_COUNTY_MASTER_AGREEMENT_SOURCE_ID,
  parseLosAngelesCountyMasterAgreementHtml,
} from './public-source-adapters'

describe('LA County master agreement adapter',()=>{
  it('normalizes official table rows into public opportunity signals',()=>{
    const html=`
      <html><body>
        <h1>Contract Opportunities</h1>
        <p>Below is a listing of open Master Agreements.</p>
        <table>
          <tr><th>Services</th><th>Solicitation Number</th><th>Solicitation Open Date</th><th>Solicitation Close Date</th><th>Analyst</th></tr>
          <tr>
            <td>Energy Support Services Master Agreement (ESSMA)</td>
            <td><a href="https://camisvr.co.la.ca.us/LACoBids/BidLookUp/BidDetail?bidNum=GCS-I10681-C">GCS-I10681-C</a></td>
            <td>4/26/2022</td>
            <td>Continuous</td>
            <td>Nazeli Albaryan</td>
          </tr>
          <tr>
            <td>Example Fixed Deadline Service</td>
            <td>ABC-123</td>
            <td>9/1/2026</td>
            <td>10/15/2026</td>
            <td>Example Analyst</td>
          </tr>
        </table>
      </body></html>`
    const rows=parseLosAngelesCountyMasterAgreementHtml(html,'2026-09-30T22:00:00Z')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      sourceId:LA_COUNTY_MASTER_AGREEMENT_SOURCE_ID,
      state:'CA',
      county:'Los Angeles',
      externalId:'GCS-I10681-C',
      procurementVehicle:'master_agreement',
      stage:'open_solicitation',
    })
    expect(rows[0]?.deadline).toBeUndefined()
    expect(rows[1]?.deadline).toBe('2026-10-15')
  })

  it('fails closed when the expected source contract disappears',()=>{
    expect(()=>parseLosAngelesCountyMasterAgreementHtml('<html>changed</html>')).toThrow(
      'la_county_master_agreement_contract_changed',
    )
  })
})
