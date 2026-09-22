'use strict';

const SPICERY_DB = {
  p: {
    'Mexican Seasoning': {
      n:'Mexican Seasoning', c:'Seasoning', icon:'🌶️', desc:'Authentic Mexican flavour blend',
      i:'Pomegranate Seeds, Dry Mango Powder, Coriander, Chilli, Cumin, Kachri, Ginger, Turmeric, Cassia Bark, Bay Leaf, Salt, Black Pepper, Ajwain, Big Cardamom, Clove, Kasoori Methi, Nutmeg',
      e:88, p:4.2, cb:11.8, ts:3.3, as:1.7, tf:4.4, sf:1.0, tr:0.3, ch:2.2, so:10
    },
    'Pav Bhaji Masala': {
      n:'Pav Bhaji Masala', c:'Blended Spices', icon:'🍛', desc:'Bold flavours for your favourite street food',
      i:'Coriander, Cumin, Red Chilli, Dry Mango Powder, Black Pepper, Cardamom, Cloves, Cinnamon, Bay Leaf, Salt, Turmeric',
      e:72, p:3.8, cb:13.2, ts:2.1, as:0.8, tf:3.5, sf:0.9, tr:0.1, ch:1.8, so:1240
    },
    'Garam Masala': {
      n:'Garam Masala', c:'Blended Spices', icon:'🫙', desc:'Classic warm spice blend for daily cooking',
      i:'Coriander, Cumin, Black Pepper, Cardamom, Cloves, Cinnamon, Bay Leaf, Nutmeg, Mace, Star Anise, Fennel Seeds',
      e:89, p:5.1, cb:10.3, ts:1.2, as:0.3, tf:5.9, sf:2.1, tr:0.2, ch:3.1, so:28
    },
    'Turmeric Powder': {
      n:'Turmeric Powder', c:'Single Spices', icon:'🟡', desc:'Pure ground turmeric root — 100% natural',
      i:'Turmeric (100%)',
      e:354, p:7.8, cb:64.9, ts:3.2, as:0.0, tf:9.9, sf:3.1, tr:0.0, ch:0.0, so:38
    },
    'Kashmiri Chilli Powder': {
      n:'Kashmiri Chilli Powder', c:'Chilli Powders', icon:'🌶️', desc:'Vibrant colour, mild heat',
      i:'Kashmiri Red Chilli (100%)',
      e:318, p:12.1, cb:49.7, ts:14.0, as:0.0, tf:8.7, sf:1.5, tr:0.0, ch:0.0, so:68
    },
    'Coriander Powder': {
      n:'Coriander Powder', c:'Single Spices', icon:'🌿', desc:'Freshly ground coriander seeds',
      i:'Coriander (100%)',
      e:298, p:12.4, cb:54.9, ts:0.0, as:0.0, tf:17.8, sf:1.0, tr:0.0, ch:0.0, so:35
    },
    'Cumin Powder': {
      n:'Cumin Powder', c:'Single Spices', icon:'🤎', desc:'Aromatic ground cumin seeds',
      i:'Cumin (100%)',
      e:375, p:17.8, cb:44.2, ts:2.3, as:0.0, tf:22.3, sf:1.5, tr:0.0, ch:0.0, so:168
    },
    'Chaat Masala': {
      n:'Chaat Masala', c:'Blended Spices', icon:'✨', desc:'Tangy, flavourful chaat companion',
      i:'Dry Mango Powder, Coriander, Cumin, Black Salt, Black Pepper, Salt, Mint, Ginger, Chilli, Cassia Bark, Clove, Ajwain',
      e:65, p:2.9, cb:12.4, ts:1.8, as:0.5, tf:2.1, sf:0.4, tr:0.1, ch:0.0, so:1680
    },
    'Kitchen King Masala': {
      n:'Kitchen King Masala', c:'Blended Spices', icon:'👑', desc:'All-purpose cooking masala',
      i:'Coriander, Cumin, Turmeric, Red Chilli, Black Pepper, Cardamom, Cloves, Cinnamon, Bay Leaf, Fennel, Nutmeg, Mace, Dry Ginger, Salt',
      e:81, p:4.5, cb:11.7, ts:1.9, as:0.4, tf:4.2, sf:1.1, tr:0.1, ch:0.0, so:920
    },
    'Biryani Masala': {
      n:'Biryani Masala', c:'Blended Spices', icon:'🍚', desc:'Fragrant biryani spice blend',
      i:'Coriander, Cumin, Black Pepper, Cardamom, Cloves, Cinnamon, Bay Leaf, Star Anise, Nutmeg, Mace, Kewra, Saffron, Fennel, Turmeric, Chilli, Salt',
      e:76, p:4.1, cb:12.9, ts:1.4, as:0.2, tf:3.8, sf:1.0, tr:0.1, ch:0.0, so:780
    }
  },
  v: {
    'Mexican Seasoning':     [{d:'100g',g:100,oz:'3.53oz',m:299,bn:'MS0000'},{d:'200g',g:200,oz:'7.05oz',m:549,bn:'MS0000'},{d:'500g',g:500,oz:'17.64oz',m:1299,bn:'MS0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:2299,bn:'MS0000'}],
    'Pav Bhaji Masala':      [{d:'100g',g:100,oz:'3.53oz',m:119,bn:'PB0000'},{d:'200g',g:200,oz:'7.05oz',m:219,bn:'PB0000'},{d:'500g',g:500,oz:'17.64oz',m:499,bn:'PB0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:899,bn:'PB0000'}],
    'Garam Masala':          [{d:'100g',g:100,oz:'3.53oz',m:109,bn:'GM0000'},{d:'200g',g:200,oz:'7.05oz',m:199,bn:'GM0000'},{d:'500g',g:500,oz:'17.64oz',m:449,bn:'GM0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:799,bn:'GM0000'}],
    'Turmeric Powder':       [{d:'100g',g:100,oz:'3.53oz',m:89, bn:'TP0000'},{d:'200g',g:200,oz:'7.05oz',m:159,bn:'TP0000'},{d:'500g',g:500,oz:'17.64oz',m:349,bn:'TP0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:599,bn:'TP0000'}],
    'Kashmiri Chilli Powder':[{d:'100g',g:100,oz:'3.53oz',m:129,bn:'KC0000'},{d:'200g',g:200,oz:'7.05oz',m:239,bn:'KC0000'},{d:'500g',g:500,oz:'17.64oz',m:549,bn:'KC0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:999,bn:'KC0000'}],
    'Coriander Powder':      [{d:'100g',g:100,oz:'3.53oz',m:79, bn:'CP0000'},{d:'200g',g:200,oz:'7.05oz',m:139,bn:'CP0000'},{d:'500g',g:500,oz:'17.64oz',m:299,bn:'CP0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:549,bn:'CP0000'}],
    'Cumin Powder':          [{d:'100g',g:100,oz:'3.53oz',m:139,bn:'CU0000'},{d:'200g',g:200,oz:'7.05oz',m:249,bn:'CU0000'},{d:'500g',g:500,oz:'17.64oz',m:569,bn:'CU0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:999,bn:'CU0000'}],
    'Chaat Masala':          [{d:'100g',g:100,oz:'3.53oz',m:99, bn:'CM0000'},{d:'200g',g:200,oz:'7.05oz',m:179,bn:'CM0000'},{d:'500g',g:500,oz:'17.64oz',m:399,bn:'CM0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:699,bn:'CM0000'}],
    'Kitchen King Masala':   [{d:'100g',g:100,oz:'3.53oz',m:119,bn:'KK0000'},{d:'200g',g:200,oz:'7.05oz',m:219,bn:'KK0000'},{d:'500g',g:500,oz:'17.64oz',m:499,bn:'KK0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:899,bn:'KK0000'}],
    'Biryani Masala':        [{d:'100g',g:100,oz:'3.53oz',m:159,bn:'BM0000'},{d:'200g',g:200,oz:'7.05oz',m:299,bn:'BM0000'},{d:'500g',g:500,oz:'17.64oz',m:699,bn:'BM0000'},{d:'1 Kg',g:1000,oz:'35.27oz',m:1299,bn:'BM0000'}],
  }
};
