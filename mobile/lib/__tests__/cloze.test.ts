import {
  fillClozeSentence,
  getClozeAnswers,
  hideClozePinyin,
  normalizeClozeAnswer,
} from "../cloze";

describe("cloze helpers", () => {
  it("fills ordered answers into their corresponding blanks", () => {
    expect(
      fillClozeSentence(
        "他回___家的时候，太太已经做___饭了。",
        "到...好"
      )
    ).toBe("他回到家的时候，太太已经做好饭了。");
  });

  it("repeats a scalar answer across multiple blanks", () => {
    expect(fillClozeSentence("我姐姐___聪明___漂亮。", "又")).toBe(
      "我姐姐又聪明又漂亮。"
    );
  });

  it("returns ordered answers for display", () => {
    expect(getClozeAnswers("到...好", 2)).toEqual(["到", "好"]);
  });

  it("normalizes supported ellipsis styles", () => {
    expect(normalizeClozeAnswer("到。。。好")).toBe("到...好");
    expect(normalizeClozeAnswer("到…好")).toBe("到...好");
  });

  it("hides pinyin embedded in a combined token", () => {
    expect(
      hideClozePinyin("zhè kuài shǒubiǎo sānqiān kuài.", "qiān", 1)
    ).toBe("zhè kuài shǒubiǎo sān___ kuài.");
    expect(
      hideClozePinyin("zhè jiàn yīfu liǎngbǎi kuài.", "bǎi", 1)
    ).toBe("zhè jiàn yīfu liǎng___ kuài.");
  });

  it("preserves punctuation around hidden pinyin", () => {
    expect(
      hideClozePinyin(
        "wǒ xǐhuan chī mángguǒ, bù xǐhuan chī píngguǒ.",
        "mángguǒ",
        1
      )
    ).toBe("wǒ xǐhuan chī ___, bù xǐhuan chī píngguǒ.");
  });

  it("does not reveal pinyin when card data is inconsistent", () => {
    expect(hideClozePinyin("wǒ ài nǐ", "hē", 1)).toBe("___");
  });

  it("hides ordered and repeated multi-blank pinyin", () => {
    expect(
      hideClozePinyin(
        "tā huí dào jiā de shíhou, tàitai yǐjīng zuò hǎo fàn le.",
        "dào...hǎo",
        2
      )
    ).toBe("tā huí ___ jiā de shíhou, tàitai yǐjīng zuò ___ fàn le.");
    expect(
      hideClozePinyin("wǒ jiějie yòu cōngmíng yòu piàoliang.", "yòu", 2)
    ).toBe("wǒ jiějie ___ cōngmíng ___ piàoliang.");
  });
});
