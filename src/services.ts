/**
 * XYP (ХУР) services that can be requested through DAN.
 * Source: https://developer.sso.gov.mn/docs/OAuth%202/сервис%20жагсаалт
 */
export const DAN_SERVICES = {
  // 1. Иргэний мэдээлэл
  WS100101_getCitizenIDCardInfo: "Иргэний үнэмлэхний мэдээлэл",
  WS100102_getCitizenBirthInfo: "Иргэний төрсний гэрчилгээний мэдээлэл",
  WS100103_getCitizenAddressInfo: "Иргэний хаягийн мэдээлэл",
  WS100104_getCitizenMarriageInfo: "Иргэн гэрлэлтийн мэдээлэл",
  WS100105_getCitizenMarriageDivorceInfo: "Иргэн гэрлэлт цуцалсан тухай мэдээлэл",
  WS100106_authorizeCitizen: "Иргэнийг хурууны хээгээр баталгаажуулах",
  WS100107_checkCitizenInfo: "Иргэний мэдээлэл тулгах",
  WS100125_checkCitizenRegnum: "Иргэний регистрийн дугаар үнэн эсэхийг шалгах",
  WS100128_getCitizenNoMarriegeInfo: "Гэрлэлт бүртгэлгүй тухай мэдээлэл",
  // 2. Үл хөдлөх хөрөнгө
  WS100201_getPropertyInfo: "Үл хөдлөх хөрөнгийн мэдээлэл",
  WS100202_getPropertyList: "Үл хөдлөх хөрөнгийн жагсаалт",
  WS100218_landOwningCertificateInfo: "Газар эзэмших, ашиглах, эрхийн гэрчилгээний мэдээлэл",
  WS100219_landOwningContractInfo: "Газар эзэмших, ашиглах, эрхийн гэрээ мэдээлэл",
  WS100220_landCadastralMapInfo: "Газрын кадастрын зурагийн мэдээлэл",
  // 3. Хуулийн этгээд
  WS100307_getLegalEntityInfoWithRegnum: "Хуулийн этгээдийн мэдээлэл",
  // 4. Тээврийн хэрэгсэл
  WS100401_getVehicleInfo: "Тээврийн хэрэгслийн мэдээлэл",
  WS100402_getVehicleOwnerHistoryList: "Тээврийн хэрэгслийн эзэмшигчийн түүхчилсэн мэдээлэл",
  WS100403_getVehiclePenaltyList: "Тээврийн хэрэгслийн торгуулийн мэдээлэл",
  WS100406_getCitizenVehicleList: "Иргэний тээврийн хэрэгслийн мэдээлэл",
  WS100407_getDriverLicenseInfo: "Жолоочийн эрхийн мэдээлэл",
  WS100417_specialDriverInfo: "Мэргэшсэн жолоочийн мэдээлэл",
  // 5. Нийгмийн даатгал
  WS100501_getCitizenSalaryInfo: "Иргэний нийгмийн даатгалын мэдээлэл",
  WS100502_getCitizenPensionInquiry: "Тэтгэврийн лавлагааны мэдээлэл",
  WS100564_pensionDocumentInfo: "Тэтгэвэр тогтоолтын хуудасны мэдээлэл",
  WS100565_getCitizenSalaryInfoEng: "Иргэний нийгмийн даатгалын мэдээлэл (англи)",
  WS100566_disabilityPensionDocumentInfo: "Хөдөлмөрийн чадвар алдсаны тэтгэвэр тогтоолтын хуудас",
  WS100567_lostCaregiverPensionDocumentInfo: "Тэжээгчээ алдсаны тэтгэвэр тогтоолтын хуудас",
  WS100572_GetPensionInfo: "Тэтгэвэр тогтоолтын хуудас",
  // 6. Татвар
  WS100601_getTaxPayerInfo: "Татвар төлөгчийн мэдээлэл",
  WS100609_getVehiclePaidTaxHistory: "Тээврийн хэрэгслийн төлбөр төлсөн нэхэмжлэлийн түүх",
  WS100610_getVehicleTaxPayableInfo: "Тээврийн хэрэгслийн төлөх ёстой нэхэмжлэлийн мэдээлэл",
  WS100611_getVehicleInfo: "Тээврийн хэрэгслийн мэдээлэл (татвар)",
  // 7. Хүүхдийн мэдээлэл
  GS10036_getChildInfo: "E-kids хүүхдийн мэдээлэл",
  // 8. Гадаадын иргэн, харьяатын газар
  FS100101_personInfo: "Гадаад иргэний мэдээлэл",
} as const;

export type DanServiceCode = keyof typeof DAN_SERVICES;

/** WSDL endpoints shown in the official DAN examples. Other groups: see the XYP (ХУР) manual. */
export const XYP_WSDL = {
  citizen: "https://xyp.gov.mn/citizen-1.3.0/ws?WSDL",
  property: "https://xyp.gov.mn/property-1.3.0/ws?WSDL",
} as const;
