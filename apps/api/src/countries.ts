// D135: countries Safeer can serve. calling: international dialling code; nsn: allowed lengths of the national
// number (without the leading 0); currency and zone: defaults offered when a company in that country is set up.
export type Country={calling:string,nsn:number[],currency:string,zone:string};
export const countries:Record<string,Country>={
 SD:{calling:'249',nsn:[9],currency:'SDG',zone:'Africa/Khartoum'},
 EG:{calling:'20',nsn:[10],currency:'EGP',zone:'Africa/Cairo'},
 SS:{calling:'211',nsn:[9],currency:'SSP',zone:'Africa/Juba'},
 SA:{calling:'966',nsn:[9],currency:'SAR',zone:'Asia/Riyadh'},
 AE:{calling:'971',nsn:[9],currency:'AED',zone:'Asia/Dubai'},
 QA:{calling:'974',nsn:[8],currency:'QAR',zone:'Asia/Qatar'},
 OM:{calling:'968',nsn:[8],currency:'OMR',zone:'Asia/Muscat'},
 KW:{calling:'965',nsn:[8],currency:'KWD',zone:'Asia/Kuwait'},
 BH:{calling:'973',nsn:[8],currency:'BHD',zone:'Asia/Bahrain'},
 JO:{calling:'962',nsn:[9],currency:'JOD',zone:'Asia/Amman'},
 LY:{calling:'218',nsn:[9],currency:'LYD',zone:'Africa/Tripoli'},
 TD:{calling:'235',nsn:[8],currency:'XAF',zone:'Africa/Ndjamena'},
 ET:{calling:'251',nsn:[9],currency:'ETB',zone:'Africa/Addis_Ababa'},
 ER:{calling:'291',nsn:[7],currency:'ERN',zone:'Africa/Asmara'},
 KE:{calling:'254',nsn:[9],currency:'KES',zone:'Africa/Nairobi'},
 UG:{calling:'256',nsn:[9],currency:'UGX',zone:'Africa/Kampala'},
};
export const defaultCountry='SD';
export const countryOf=(code:unknown)=>countries[typeof code==='string'&&code in countries?code:defaultCountry];
