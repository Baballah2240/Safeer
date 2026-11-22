// D135: countries Safeer can serve. D140: Sudan, its neighbours (EG, LY, TD, CF, SS, ET, ER) and SA, QA, KW only for now. calling: international dialling code; nsn: allowed lengths of the national
// number (without the leading 0); currency and zone: defaults offered when a company in that country is set up.
export type Country={calling:string,nsn:number[],currency:string,zone:string};
export const countries:Record<string,Country>={
 SD:{calling:'249',nsn:[9],currency:'SDG',zone:'Africa/Khartoum'},
 EG:{calling:'20',nsn:[10],currency:'EGP',zone:'Africa/Cairo'},
 SS:{calling:'211',nsn:[9],currency:'SSP',zone:'Africa/Juba'},
 SA:{calling:'966',nsn:[9],currency:'SAR',zone:'Asia/Riyadh'},
 QA:{calling:'974',nsn:[8],currency:'QAR',zone:'Asia/Qatar'},
 KW:{calling:'965',nsn:[8],currency:'KWD',zone:'Asia/Kuwait'},
 LY:{calling:'218',nsn:[9],currency:'LYD',zone:'Africa/Tripoli'},
 TD:{calling:'235',nsn:[8],currency:'XAF',zone:'Africa/Ndjamena'},
 ET:{calling:'251',nsn:[9],currency:'ETB',zone:'Africa/Addis_Ababa'},
 ER:{calling:'291',nsn:[7],currency:'ERN',zone:'Africa/Asmara'},
 CF:{calling:'236',nsn:[8],currency:'XAF',zone:'Africa/Bangui'},
};
export const defaultCountry='SD';
export const countryOf=(code:unknown)=>countries[typeof code==='string'&&code in countries?code:defaultCountry];
