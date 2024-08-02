//spell check out status
const spellCheck =(term)=>{
    return   term.startsWith('sou') && term != 'southern stock' ? 'southern stock' :
             term.startsWith('l') && term != 'limited' ? 'limited' :
             term.startsWith('c') && term != 'close-out' ? 'close-out' :
             term.startsWith('e') && term != 'exempt' ? 'exempt' :
             term.startsWith('s') && term != 'stock' ? 'stock' :
             term
}

const quickSearchString = (term, stock)=>{
    let searchString = 'FIND \''+term+'\' IN ALL FIELDS RETURNING Tag__c(id, Tag_Description__c, Search_Slug_2__c,'
                              +' Product__c, Product_Name__c, ATS_Score__c, Stock_Status__c where product__r.IsActive = true';
    
    stock != null ? searchString += ' and Product__r.Stock_Status__c  = \''+stock+'\' order by Stock_Status__c desc nulls last)' :searchString += ' order by Stock_Status__c desc nulls last)'; 
    return searchString; 
  }
//Build cpq tag search string. We limit to active products and remove non-stock. We pass in the warehouse code so we can search for AI by location.
  const cpqSearchString = (term, stock, wh) =>{
    let status = 'Active'
    let nonStock = 'Non-Stock'; 
    let warehouseSearchCode = wh != null ? wh[0] : '';
    let input = wh != null ? `${term} ${wh}`: term; 
    let wareHouseSearch = wh != null ? true :false; 
    let searchString = 'FIND \''+input+'\' IN ALL FIELDS RETURNING Tag__c(id, Tag_Description__c, Search_Slug_2__c, '
    +'Product__c, Product_Name__c, Product__r.Temp_Unavailable__c,Product__r.Temp_Mess__c, ATS_Score__c, Stock_Status__c, '
    +'W_Focus_Product__c, W_Product_Profitability__c, W_Program_Score__c, W_Inventory_Score__c, Product__r.Agency_Pricing__c, Product__r.Product_Status__c, '
    +'Floor_Price__c, Product__r.Total_Product_Items__c,Product__r.Floor_Type__c, Product_Code__c where product__r.IsActive = true ' //and Tag_Status__c = \''+ status+'\''
  
    //previous before order by status then score
    //stock != null ? searchString += ' and Stock_Status__c  = \''+stock+'\' order by Stock_Status__c desc nulls last)' : searchString += ' order by Stock_Status__c desc nulls last)'; 
    stock != null ? searchString += ' and Stock_Status__c  = \''+stock+'\' and Stock_Status__c != null and Stock_Status__c != \''+nonStock+'\')' : searchString +=' and Stock_Status__c != null and Stock_Status__c != \''+nonStock+'\')';
    let backUpString = wareHouseSearch ? searchString.replace(` ${wh}`, '') : '';
  
  return {'builtTerm':searchString, 
          'wareHouseSearch':wareHouseSearch,
          'backUpQuery': backUpString,
          'warehouseCode': warehouseSearchCode
         }; 
  }

  const cpqSearchStringMobile = (term, stock) =>{
    let status = 'Active'
    let searchString = 'FIND \''+term+'\' IN ALL FIELDS RETURNING Tag__c(id, Tag_Description__c, Search_Slug_2__c, '
    +'Product__c, Product_Name__c, Product__r.Temp_Unavailable__c,Product__r.Temp_Mess__c, ATS_Score__c, Stock_Status__c, '
    +'W_Focus_Product__c, W_Product_Profitability__c, W_Program_Score__c, W_Inventory_Score__c, Product__r.Agency_Pricing__c, '
    +'Product__r.Ship_Weight__c, Product__r.Pallet_Qty__c, Product__r.SGN__c, Product__r.RUP__c, '
    +'Floor_Price__c, Product__r.Total_Product_Items__c,Product__r.Floor_Type__c, Product_Code__c where product__r.IsActive = true' //and Tag_Status__c = \''+ status+'\''
  //once score is stable order by ATS_Score__c desc nulls last
  stock != null ? searchString += ' and Stock_Status__c  = \''+stock+'\' order by Stock_Status__c desc nulls last)' :searchString += ' order by Stock_Status__c desc nulls last)'; 
  return searchString; 
  }

  //used for quick price search
  const cpqQuickPriceSearch = (term, stock, wh) =>{
    let status = 'Active'
    let nonStock = 'Non-Stock'; 
    let warehouseSearchCode = wh != null ? wh[0] : '';
    let input = wh != null ? `${term} ${wh}`: term; 
    let wareHouseSearch = wh != null ? true :false; 
    let searchString = 'FIND \''+input+'\' IN ALL FIELDS RETURNING Tag__c(id, Tag_Description__c, Search_Slug_2__c, '
    +'Product__c, Product_Name__c, Product__r.Temp_Unavailable__c,Product__r.Temp_Mess__c, ATS_Score__c, Stock_Status__c, '
    +'W_Focus_Product__c, W_Product_Profitability__c, W_Program_Score__c, W_Inventory_Score__c, '
    +'Floor_Price__c, Product__r.Total_Product_Items__c,Product__r.Floor_Type__c, Product_Code__c where product__r.IsActive = true ' //and Tag_Status__c = \''+ status+'\''
  
    //previous before order by status then score
    //stock != null ? searchString += ' and Stock_Status__c  = \''+stock+'\' order by Stock_Status__c desc nulls last)' : searchString += ' order by Stock_Status__c desc nulls last)'; 
    stock != null ? searchString += ' and Stock_Status__c  = \''+stock+'\' and Stock_Status__c != null and Stock_Status__c != \''+nonStock+'\')' : searchString +=' and Stock_Status__c != null and Stock_Status__c != \''+nonStock+'\')';
    let backUpString = wareHouseSearch ? searchString.replace(` ${wh}`, '') : '';
  
  return {'builtTerm':searchString, 
          'wareHouseSearch':wareHouseSearch,
          'backUpQuery': backUpString,
          'warehouseCode': warehouseSearchCode
         }; 
  }
const uniqVals = (arr, track = new Set())=>{
  
  return  arr.filter(({Product__c})=>track.has(Product__c)? false: track.add(Product__c))
 
}

const uniqPromo = (arr, track = new Map())=>{
  return arr.filter(({Search_Label__c})=>track.has(Search_Label__c)? false : track.set(Search_Label__c))
}

const promoProductNames = (info)=>{
  const names = info.reduce((acc, {Search_Label__c, Product_Name__c}) => {
    acc[Search_Label__c] ??= {Search_Label__c: Search_Label__c, pn: []};
      
      acc[Search_Label__c].pn.push({id: Search_Label__c, name: Product_Name__c});
    
  //console.log(typeof acc)
    return acc;
  }, {});

return names; 
}

const setNames = (arr) =>{
  let backArr
  if(arr.length > 3){
    backArr = arr.slice(0,3);
    let realSize = arr.length + 1;
    let left = arr.length -2
    let lastLine = {id:realSize, name:`Plus ${left} more products`}
    backArr.push(lastLine)
    return backArr
  }
  return arr; 
}
const promoLoad = (arr, singles)=>{
  const prods = singles; 
  console.log(1, arr)
  let combo = arr.map(x=>({
    ...x,
    prodNames: setNames(prods[x.Search_Label__c].pn),
    btnName: "utility:add",
    btnVariant: "brand",
    experDate: getFormattedDate(x.Search_Label__r.Expiration_Date__c).prettyDate,
    experDays: getFormattedDate(x.Search_Label__r.Expiration_Date__c).diff,
    dayClass:  getFormattedDate(x.Search_Label__r.Expiration_Date__c).diff<= 7 ? 'redClass': '',
  }))

  return combo; 
}


const getFormattedDate = (stringDateIn) =>{
  let dateNow = new Date();
  let today = dateNow.getFullYear()+'-'+(dateNow.getMonth()+1)+'-'+dateNow.getDate();
  let date = new Date(stringDateIn)
  let date2 = new Date(today)
  let year = date.getFullYear();
  let month = (1 + date.getMonth()).toString().padStart(2, '0');
  let day = date.getDate().toString().padStart(2, '0');
  let prettyDate = month + '/' + day + '/' + year;
  let diff = Math.ceil(((date.getTime() - date2.getTime())/ (1000 * 3600 * 24))) //-1;
  return {
          prettyDate,
          diff
  }
      }
//If you need to add a single key value from one object to another object. 
//Pass in arry1 = main array of data what is being returned and accepting the value
//arry2 = array of obj that contain field you want share
//arryKey1 & arryKey2 pass in unique key values that will join two objects together keyToadd is the key name of the value you want to share
const addSingleKey = (arry1, arryKey1, arry2, arryKey2, keyToAdd) => {
  let val1 = arryKey1;
  let val2 = arryKey2;
  let keyField = keyToAdd;
  const x = arry1.map(obj => {
    const join = arry2.find(tmp => tmp[val2] === obj[val1])
    
    if (join){ 
      return {  ...obj, Qty:join[keyField]}
    } 
  })
  return x; 
}

export{
       cpqQuickPriceSearch,
       spellCheck,
       quickSearchString,
       cpqSearchString,
       uniqVals, 
       cpqSearchStringMobile,
       uniqPromo,
       promoProductNames,
       promoLoad,
       getFormattedDate,
       addSingleKey
      }


///SEARCH STRING FOR ADDING IN STATUS FOR SEARCH
    //   let searchString = `FIND '${term}' IN ALL FIELDS RETURNING Tag__c(id, Tag_Description__c, Search_Slug_2__c,`
    //   +`Product__c, Product_Name__c, Product__r.Temp_Unavailable__c,Product__r.Temp_Mess__c, ATS_Score__c, Stock_Status__c, `
    //   +`W_Focus_Product__c, W_Product_Profitability__c, W_Program_Score__c, W_Inventory_Score__c, Floor_Price__c,`
    //   +`Product__r.Total_Product_Items__c,Product__r.Floor_Type__c, Product_Code__c where product__r.IsActive = true and Tag_Status__c = 'Active'`;
    //   stock != null ? searchString += `and Stock_Status__c  = '${stock}' order by ATS_Score__c desc nulls last)` :searchString +=` order by ATS_Score__c desc nulls last)`
    // return searchString;
