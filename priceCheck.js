import { LightningElement,track, wire } from 'lwc';
import { createRecord } from 'lightning/uiRecordApi';
import FORM_FACTOR from '@salesforce/client/formFactor';
import checkPrice from '@salesforce/apex/quickPriceSearch.getPricing';
import wareHouses from '@salesforce/apex/quickPriceSearch.getWarehouse';
import inCounts from '@salesforce/apex/quickPriceSearch.inCounts';
import queryType from '@salesforce/apex/lwcHelper.getRecordTypeId';
import {newInventory,allInventory, roundNum} from 'c/helper'
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import Id from '@salesforce/user/Id';
import TERM from '@salesforce/schema/Query__c.Term__c';
import SUC from '@salesforce/schema/Query__c.successful__c';
import COUNT from '@salesforce/schema/Query__c.Records_Returned__c';
import RECTYPE from '@salesforce/schema/Query__c.RecordTypeId';
import DEV from '@salesforce/schema/Query__c.Device_Type__c';

// Import helper functions and regular expressions
import { spellCheck, cpqSearchString, uniqVals, addSingleKey } from 'c/tagHelper';
import { mergePricing } from 'c/internHelper';
import searchTag from '@salesforce/apex/quickPriceSearchTag.cpqSearchTag';

const REGEX_SOSL_RESERVED = /(\?|&|\||!|\{|\}|\[|\]|\(|\)|\^|~|\*|:|"|\+|\\)/g;
const REGEX_STOCK_RES = /(stock|sock|limited|limted|lmited|limit|close-out|close out|closeout|close  out|exempt|exmpet|exemept|southern stock|southernstock|southner stock)/g;
const REGEX_COMMA = /(,)/g;
const REGEX_24D = /2,4-D|2 4-d|2, 4-D/gi;
const REGEX_WAREHOUSE = /wh\s*\d\d\d/gi;
const REGEX_WHITESPACE = /\s/g;

export default class PriceCheck extends LightningElement {
    // my variables
    searchTerm;
    searchQuery;
    whSearch;
    stock;
    // end of my variables
    priceBook = '01s410000077vSKAAY';
    loaded;
    formSize;
    isPinned = false;
    showWarn = false;
    btnLabel = 'Check Inventory';
    showInventory = false;
    warehouse;
    error;
    success;
    recFound;
    queryRecordType
    deviceType;
    @track pinnedCards = [];
    @track prod = [];

//get warehouse
@wire(wareHouses)
wiredWarehouse({ error, data }) {
    if (data) {
        let back  = data.map((item, index) =>({
            ...item, 
            label:item.Name, 
            value:item.Id
        
        }))
        back.unshift({label:'All', value:'All'})
        this.warehouseOptions = [...back]; 
        
    } else if (error) {
        this.error = error;
        console.error(this.error)
    }
} 


@wire(queryType, ({objectName: 'Query__c', recTypeName: 'Quick_Search'}))
wiredRec({error, data}){
    if(data){
        this.queryRecordType = data;
        
    }
}
connectedCallback(){ 
    this.formSize = this.screenSize(FORM_FACTOR);
    this.loaded = true;     
}

screenSize = (screen) => {
    this.deviceType = screen === 'Large'? 'Desktop' : 'Mobile'
    return screen === 'Large'? true : false  
}

handleKeys(evt){
    let enterKey = evt.keyCode === 13;
    if(enterKey){
        this.searchTerm = evt.target.value;
        this.handleSearch();
    }
}

// ADD THIS BACK IN TO SAVE SEARCH TERM 


async advancedSearch() {

    this.whSearch = this.template.querySelector('[data-value="searchInput"]').value.trim().toLowerCase().replace(REGEX_WHITESPACE, "").match(REGEX_WAREHOUSE);
    this.stock = this.template.querySelector('[data-value="searchInput"]').value.trim().toLowerCase().match(REGEX_STOCK_RES);
    this.searchTerm = this.template.querySelector('[data-value="searchInput"]').value.toLowerCase().replace(REGEX_24D, '2 4-D')
        .replace(REGEX_COMMA, ' and ').replace(REGEX_SOSL_RESERVED, '?').replace(REGEX_STOCK_RES, '').replace(REGEX_WAREHOUSE, '').trim();

    if (this.searchTerm.length < 2) {
        // LIGHTNING ALERT HERE
        return;
    }

    let searchRacks;
    let backUpQuery;
    let warehouseCode;

    if (this.stock) {

        this.stock = spellCheck(this.stock[0])

    }

    let buildSearchInfo = cpqSearchString(this.searchTerm, this.stock, this.whSearch);
    this.searchQuery = buildSearchInfo.builtTerm;
    searchRacks = buildSearchInfo.wareHouseSearch;
    backUpQuery = buildSearchInfo.backUpQuery;
    warehouseCode = buildSearchInfo.warehouseCode;

    this.loaded = false;

    try {

        let data = await searchTag({ searchKey: this.searchQuery, searchWareHouse: searchRacks, backUpSearch: backUpQuery, warehouseKey: warehouseCode })
        let tags = data.tags !== undefined ? data.tags : [];
        let backUpSearchUsed = data.backUpSearchUsed;
        //pricing array from apex
        let pricing = data.pricing; 

        console.log('PRICING: ', pricing)
        let once = tags.length > 1 ? await uniqVals(tags) : tags;
        console.log("ONCE: ", once);
        this.searchSize = once.length;
        once.sort((a, b) => {

            const stockStatusA = (a.Stock_Status__c || '').toLowerCase();
            const stockStatusB = (b.Stock_Status__c || '').toLowerCase();
            
            const isBottomStatus = status => ['none', 'unknown', ''].includes(status);
            
            if (isBottomStatus(stockStatusA) && !isBottomStatus(stockStatusB)) return 1;
            if (!isBottomStatus(stockStatusA) && isBottomStatus(stockStatusB)) return -1;
            
            if (stockStatusA !== stockStatusB) {
                return stockStatusB.localeCompare(stockStatusA);
            }
            
            const scoreA = a.ATS_Score__c || 0;
            const scoreB = b.ATS_Score__c || 0;
            
            if (scoreA !== scoreB) {
                return scoreB - scoreA;
            }
            
            return (a.Product_Code__c || '').localeCompare(b.Product_Code__c || '');
        });    
        //join the sorted products with pricing 
        let final = mergePricing(once, 'Product__c', pricing, 'Product2Id', 'Level_1_UserView__c');
        final = mergePricing(final, 'Product__c', pricing, 'Product2Id', 'Floor_Margin__c');
        final = mergePricing(final, 'Product__c', pricing, 'Product2Id', 'Level_2_UserView__c');
        final = mergePricing(final, 'Product__c', pricing, 'Product2Id', 'Product_Cost__c');
        final = mergePricing(final, 'Product__c', pricing, 'Product2Id', 'Level_2_Margin__c');
        // Add any other fields you need from the pricing array
        console.log("FINAL: ", final)
        this.prod = await final.map((item, index) => ({
            Id: item.Product__c || `temp-${index}`,
            name: item.Product_Name__c + ' - ' + item.Product_Code__c,
            cost: item.Product__r?.Agency_Pricing__c ? 'Agency' : (item.Product_Cost__c || 'N/A'),
            flr: item.Floor_Price__c || 'N/A',
            lev1: item.Level_1_UserView__c || 'N/A',
            lev2: item.Level_2_UserView__c || 'N/A',
            slug: item.Product__r?.Agency_Pricing__c 
                ? `Agency - $${item.Floor_Price__c || 'N/A'}` 
                : `cost $${item.Product_Cost__c || 'N/A'}  flr $${item.Floor_Price__c || 'N/A'}-${item.Floor_Margin__c || 'N/A'}%   Level 1 $${item.Level_1_UserView__c || 'N/A'}`,
            stock: item.Stock_Status__c || 'None',
            allStock: item.Product__r?.Total_Product_Items__c || 'N/A',
            ProductCode: item.Product_Code__c || 'N/A',
            url: `https://advancedturf.lightning.force.com/lightning/r/Product2/${item.Product__c}/related/ProductItems/view`,
            showPricing: false,
            Agency_Product__c: item.Product__r?.Agency_Pricing__c || false,
            displayPrice: item.Product__r?.Agency_Pricing__c ? item.Floor_Price__c || 'N/A' : (item.Level_2_UserView__c || 'N/A'),
            displayMargin: item.Product__r?.Agency_Pricing__c ? 'Agency' : (item.Level_2_Margin__c || 'N/A'),
        }));

        if (backUpSearchUsed) {
            let DIDNT_FIND_AT_WAREHOUSE = [{ Id: '1343', Name: `Not yet tagged for ${this.whSearch}, confirm Inventory after Selection` }];
            this.prod = [...DIDNT_FIND_AT_WAREHOUSE, ...this.prod];
        }

    } catch (error) {

        console.error(error);
        this.error = error;

    } finally {

        this.loaded = true;

    }

    // Console log the final value of prod
    console.log('prod array:', this.prod);

}


async handleSearch(){

    this.advancedSearch();
    this.loaded = true;

}

openInputs(evt){
    let targId = evt.currentTarget.dataset.name
    let index = this.prod.findIndex(x=>x.Id === targId)
    this.prod[index].showPricing = true;
}
closeInputs(evt){
    let targId = evt.currentTarget.dataset.close
    let index = this.prod.findIndex(x=>x.Id === targId)
    this.prod[index].showPricing = false;
}
pinInputs(){
    if(!this.pinnedCards[0].showPricing){
        this.pinnedCards[0].showPricing = true;
    }else{
        this.pinnedCards[0].showPricing = false;

    }
}

handleMargin(evt) {

    let index = this.prod.findIndex(x => x.Id === evt.target.name);

    if (index === -1) {
        console.error('Product not found');
        return;
    }

    if (this.prod[index].Agency_Product__c) {
        return; // Do nothing for agency products
    }
    
    window.clearTimeout(this.delay);
    let margin = evt.target.value ? Number(evt.target.value) : null;
    
    this.delay = setTimeout(() => {
        let cost = this.prod[index].cost;
        let floorMargin = this.prod[index].Floor_Margin__c || 0;

        if (margin === null) {
            // If no new value entered, use the current displayMargin
            margin = this.prod[index].displayMargin;
        }

        if (floorMargin > margin) {
            this.prod[index].displayPrice = 'below floor';
            this.prod[index].displayMargin = margin;
        } else {
            this.prod[index].displayPrice = `$${roundNum((cost / (1 - (margin / 100))), 2)}`;
            this.prod[index].displayMargin = margin;
        }

        // Force a re-render
        this.prod = [...this.prod];
    }, 500);
}
handlePinMargin(evt){
    window.clearTimeout(this.delay)
    let margin = Number(evt.target.value);
    let index = this.pinnedCards.findIndex(x=>x.Id === evt.target.name);
    this.delay = setTimeout(()=>{
        let cost = this.pinnedCards[index].cost;
        if(this.pinnedCards[index].Floor_Margin__c > margin){
            this.pinnedCards[index].displayPrice = 'below floor'
            this.pinnedCards[index].displayMargin = margin;
        }else{
            this.pinnedCards[index].displayPrice = `$${roundNum((cost/(1- (margin)/100)), 2 )}`;
            this.pinnedCards[index].displayMargin = margin; 
        }
    },500)
}
fadeWarn(){
    this.showWarn = true;
    window.clearTimeout(this.delay);
    this.delay = setTimeout(()=>{
        this.showWarn = false;
    },1250)
}
pinCard(evt){
    let x = this.prod.find((y)=> y.Id === evt.currentTarget.dataset.pin);
    if(this.pinnedCards.length<1){
        this.pinnedCards = [...this.pinnedCards, x]
        this.isPinned = true; 
        this.prod.splice(this.prod.findIndex(a=>a.Id ===x.Id), 1)
    }else{
        this.fadeWarn();
    }
}
unPinCard(evt){
    let index = this.pinnedCards.findIndex(y=> y.Id === evt.currentTarget.dataset.unpin);
    this.pinnedCards.splice(index,1);
    this.isPinned = this.pinnedCards.length > 0 ? true : false;
}

//Invetory Section
checkInv(event){
    event.preventDefault();
    if(this.prod.length<1){
    alert('must have found at least 1 product');
            
            event.target.checked = false;
            return; 
        }
        if(!this.showInventory){ 
            this.showInventory = true; 
            this.btnLabel = 'Check Pricing';
        }else{ 
            this.showInventory = false;
            this.warehouse = ''; 
            this.btnLabel = 'Check Inventory';
        }
        
    }

    async checkInventory(locId){
        //console.log("LOCATION ID: ", locId)
        this.warehouse = locId.detail.value; 
        console.log("WAREHOUSE: ", this.warehouse);
        this.loaded = false;
        let data = this.isPinned ? [...this.prod, ...this.pinnedCards] : [...this.prod];
        let pcSet = new Set();
        let prodCodes = [];
        try{
            data.forEach(x=>{
                pcSet.add(x.ProductCode);
                console.log("Product Code: ", x)
            })
            prodCodes = [...pcSet];
            console.log('PROD CODES: ', prodCodes);

            let inCheck = await inCounts({pc:prodCodes, locId:this.warehouse});
            console.log('Inventory data received:', inCheck);
            
            this.prod = this.warehouse === 'All' ? await allInventory(data, inCheck) : await newInventory(data, inCheck);
            console.log('Processed inventory:', this.prod);

            if(this.isPinned){
                let back = this.isPinned = true ? this.prod.find(x => x.Id === this.pinnedCards[0].Id) : '';
                this.prod.splice(this.prod.findIndex(a=>a.Id ===this.pinnedCards[0].Id), 1) 
                this.pinnedCards[0].allStock = back?.allStock ?? 'not found'; 
                this.pinnedCards[0].wInv = back?.wInv ?? 'not found'; 
            }
             
            
            //console.log(JSON.stringify(this.prod)); 
        }catch(error){
            console.log(error)
            this.error = error;
            const evt = new ShowToastEvent({
                title: 'Error loading inventory',
                message: this.error,
                variant: 'warning'
            });
            this.dispatchEvent(evt);
        }finally{
            this.loaded = true;
        }    
        
    }
}
