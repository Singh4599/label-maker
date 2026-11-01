// ── GONI STICKER DATA ──
// Single DB. c = 'Cold Storage' or 'Shop' — shows in category dropdown.
// Label auto-generates from product data + date inputs. No extra fields needed.

const GONI_DB = (function() {
  const raw = [
    // ── COLD STORAGE ──────────────────────────────────────────────────
    { c:'Cold Storage', n:'CORIANDER GREEN SEASONING',            b:'CGSKMU1-1026',  i:'(In Descending Order By Weight) CORIANDER, DEHYDRATED CORIANDER LEAVES POWDER, TURMERIC, EDIBLE RICE BRAN OIL' },
    { c:'Cold Storage', n:'DHANAJEERA (MIX MASALA POWDER)',       b:'DJMMPKMU1-1026',i:'(In Descending Order By Weight) CORIANDER, CUMIN, TURMERIC,' },
    { c:'Cold Storage', n:'CHILLI POWDER KASHMIRI',               b:'CPKKMU2-1026',  i:'Chilli,\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Cold Storage', n:'YELLOW CHILLI SEASONING',              b:'YCSM-1026',     i:'(In Descending Order By Weight) YELLOW PEPPER, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Cold Storage', n:'GINGER SEASONING',                     b:'GSM-1026',      i:'(In Descending Order By Weight) GINGER, RICE FLOUR, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Cold Storage', n:'WHITE CHILLI SEASONING',               b:'WCSM-1026',     i:'(In Descending Order By Weight) DEHYDRATED WHITE CHILLI, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Cold Storage', n:'DRY MANGO SEASONING',                  b:'DMSM-1026',     i:'(In Descending Order By Weight) DRY MANGO, RICE FLOUR, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Cold Storage', n:'CUMIN SEASONING',                      b:'CSM-1026',      i:'(In Descending Order By Weight) CUMIN, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Cold Storage', n:'MIX MASALA POWDER',                    b:'MMSMM-1026',    i:'(In Descending Order By Weight) Red Chillies, Coriander, Poppy Seeds, Garlic, Onion, Coconut, Nutmeg, Turmeric, Cumin, Shahjeera, Cardamom, Cloves, Mace, Black Pepper, Fenugreek Seeds, Star Anise, Stoneflower, Fennel Seeds, Black Cardamom, Bay Leaves, Asafoetida, Sichuan Pepper, Iodised Salt.' },
    { c:'Cold Storage', n:'CHILLI POWDER KASHMIRI UNCHA',         b:'CPKUV-1026',    i:'Chilli,\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Cold Storage', n:'CORIANDER SP SEASONING',               b:'CSPSV-1026',    i:'(In Descending Order By Weight) CORIANDER, DEHYDRATED CORIANDER LEAVES POWDER, TURMERIC, EDIBLE RICE BRAN OIL' },
    { c:'Cold Storage', n:'CHILLI POWDER GOLDIEE',                b:'CPGV-1026',     i:'Chilli,\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Cold Storage', n:'CHILLI POWDER PUSHP',                  b:'CPPV-1026',     i:'Chilli,\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Cold Storage', n:'CHILLI POWDER SP LAL CC',              b:'CPSPLCCV-1026', i:'Chilli,\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Cold Storage', n:'CHILLI POWDER C KORA',                 b:'CPCKV-1026',    i:'Chilli,\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Cold Storage', n:'WHITE PEPPER SEASONING',               b:'WPSV-1026',     i:'(In Descending Order By Weight) WHITE PEPPER, RICE FLOUR, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Cold Storage', n:'CHILLI POWDER SP LAL',                 b:'CPSPLV-1026',   i:'Chilli,\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    // ── SHOP ──────────────────────────────────────────────────────────
    { c:'Shop', n:'GOLDEN TURMERIC POWDER',                       b:'GTP-1026',      i:'TURMERIC' },
    { c:'Shop', n:'SELAM TURMERIC POWDER',                        b:'STP-1026',      i:'TURMERIC' },
    { c:'Shop', n:'CHILLI POWDER KASHMIRI',                       b:'CPKKMU2-1026',  i:'Chilli.\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Shop', n:'MALVANI MIX SPECIAL MASALA',                   b:'MMSMM-1026',    i:'(In Descending Order By Weight) Red Chillies, Coriander, Poppy Seeds, Garlic, Onion, Coconut, Nutmeg, Turmeric, Cumin, Shahjeera, Cardamom, Cloves, Mace, Black Pepper, Fenugreek Seeds, Star Anise, Stoneflower, Fennel Seeds, Black Cardamom, Bay Leaves, Asafoetida, Sichuan Pepper, Iodised Salt.' },
    { c:'Shop', n:'CORIANDER GREEN SEASONING',                    b:'CGSKMU1-1026',  i:'(In Descending Order By Weight) CORIANDER, DEHYDRATED CORIANDER LEAVES POWDER, TURMERIC, EDIBLE RICE BRAN OIL' },
    { c:'Shop', n:'DHANAJEERA (MIX MASALA POWDER)',               b:'DJMMPKMU1-1026',i:'(In Descending Order By Weight) CORIANDER, CUMIN, TURMERIC,' },
    { c:'Shop', n:'CORIANDER SARAS SEASONING',                    b:'CSS-1026',      i:'(In Descending Order By Weight) CORIANDER, DEHYDRATED CORIANDER LEAVES POWDER, TURMERIC, EDIBLE RICE BRAN OIL' },
    { c:'Shop', n:'RESHAMPATTI KHANDELA CHILLI BLEND SEASONING',  b:'RKCBS-1026',    i:'(In Descending Order By Weight) Chilli, Salt, Edible Rice Bran Oil.' },
    { c:'Shop', n:'DANDICUT KHANDELA CHILLI BLEND SEASONING',     b:'DKCBS-1026',    i:'(In Descending Order By Weight) Chilli, Salt, Edible Rice Bran Oil.' },
    { c:'Shop', n:'PALITANA KHANDELA CHILLI BLEND SEASONING',     b:'PKCBS-1026',    i:'(In Descending Order By Weight) Chilli, Salt, Edible Rice Bran Oil.' },
    { c:'Shop', n:'KASHMIRI KHANDELA CHILLI BLEND SEASONING',     b:'KKCBS-1026',    i:'(In Descending Order By Weight) Chilli, Salt, Edible Rice Bran Oil.' },
    { c:'Shop', n:'CHILLI POWDER SP LAL',                         b:'CPSPLV-1026',   i:'Chilli.\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Shop', n:'CHILLI POWDER SP LAL UNCHA',                   b:'CPSPLCCV-1026', i:'Chilli.\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Shop', n:'GINGER SEASONING',                             b:'GSM-1026',      i:'(In Descending Order By Weight) GINGER, RICE FLOUR, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Shop', n:'CUMIN SEASONING',                              b:'CSM-1026',      i:'(In Descending Order By Weight) CUMIN, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Shop', n:'DRY MANGO SEASONING',                          b:'DMSM-1026',     i:'(In Descending Order By Weight) DRY MANGO, RICE FLOUR, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Shop', n:'BLACK PEPPER SEASONING',                       b:'BPS-1026',      i:'(In Descending Order By Weight) BLACK PEPPER, EDIBLE RICE BRAN OIL' },
    { c:'Shop', n:'METHI SEASONING',                              b:'MS-1026',       i:'(In Descending Order By Weight) FENUGREEK SEED, TURMERIC, EDIBLE RICE BRAN OIL' },
    { c:'Shop', n:'CORIANDER SEASONING',                          b:'CS-1026',       i:'(In Descending Order By Weight) CORIANDER, TURMERIC, EDIBLE RICE BRAN OIL' },
    { c:'Shop', n:'SAMBHAR CHILLI BLEND SEASONING',               b:'SCBS-1026',     i:'(In Descending Order By Weight) Chilli, Salt, Split Mustard seeds, Split fenugreek seeds, mustard oil, asafoetida.' },
    { c:'Shop', n:'SAMBHAR KASHMIRI CHILLI BLEND SEASONING',      b:'SKCBS-1026',    i:'(In Descending Order By Weight) Chilli, Salt, Split Mustard seeds, Split fenugreek seeds, mustard oil, asafoetida.' },
    { c:'Shop', n:'JEERA SUPER',                                  b:'JS1026',        i:'(cumin seeds)' },
    { c:'Shop', n:'RAI',                                          b:'R1026',         i:'mustard seeds' },
    { c:'Shop', n:'RAJWADI GARAM MASALA',                         b:'RGM-1026',      i:'(In Descending Order By weight) Coriander, Chilli, Edible Common Salt, Cumin, Fennel, Cassia Bark, Star Anise, Black Cardamom, Bay Leaf, Caraway, Sichuan Pepper, Black Pepper, Clove, Cotton seed oil, Mace.' },
    { c:'Shop', n:'SPECIAL GARAM MASALA',                         b:'SGM-1026',      i:'(In Descending Order By weight) Coriander, Chilli, Edible Common Salt, Cumin, Fennel, Cassia Bark, Star Anise, Black Cardamom, Bay Leaf, Caraway, Sichuan Pepper, Black Pepper, Clove, Cotton seed oil, Mace.' },
    { c:'Shop', n:'VARIYALI SEASONING',                           b:'VS-1026',       i:'(In Descending Order By Weight) FENNEL SEEDS, SALT, EDIBLE RICE BRAN OIL' },
    { c:'Shop', n:'CHILLI POWDER SP LINE',                        b:'CPSPLV-1026',   i:'Chilli.\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
    { c:'Shop', n:'CHILLI POWDER KASHMIRI SUPER DELUXE',          b:'CPKKMU1-1026',  i:'Kashmiri Chilli Stemless\nRice bran edible oil not more than 2%.\n[Saturated fat - 3%, Trans fat - 0.1%]' },
  ];

  const p = {}, v = {};
  raw.forEach(function(prod) {
    // Use category+name as key so same-named products in both categories coexist
    const key = prod.c + '||' + prod.n;
    p[key] = { n: prod.n, b: prod.b, i: prod.i, c: prod.c, _key: key };
    v[key] = [{ d: '50 Kg', g: 50000, m: 0, bn: prod.b }];
  });
  return { p, v };
})();
