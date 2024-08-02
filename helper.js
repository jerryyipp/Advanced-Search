const mergePricing = (arry1, arryKey1, arry2, arryKey2, keyToAdd) => {
    return arry1.map(obj => {
      const join = arry2.find(tmp => tmp[arryKey2] === obj[arryKey1]);
      if (join) {
        return { ...obj, [keyToAdd]: join[keyToAdd] };
      }
      return obj;
    });
}

export{
    mergePricing
}
