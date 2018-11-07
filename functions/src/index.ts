import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { dialogflow } from 'actions-on-google';

// Instantiate a firestore client

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
db.settings({ timestampsInSnapshots: true });

const app = dialogflow({debug: true});

//Setup contexts
const Contexts = {
  ADD_EXPENSE: 'add_expense_context'
};

app.intent('Default Fallback Intent', conv => {
  conv.ask(`I didn't understand`)
  conv.ask(`I'm sorry, can you try again?`)
});

//TODO: add sign in
//conv.ask(new SignIn());

const EN_TRANSLATIONS = {
  EXPENSE_ADDED_MESSAGE: 'Expense added',
  CATEGORY_ADDED_MESSAGE: 'Category created',
  CREATE_CATEGORY_AND_SAVE_EXPENSE_MESSAGE: 'The category does not exist, should I create it?',
  EMPTY_CATEGORIES_MESSAGE: 'There are no available categories',
  CATEGORIES_LIST_MESSAGE: 'Available categories are:'
}

const TRANSLATIONS = EN_TRANSLATIONS;
const OTHER_CATEGORY = 'other';

app.intent('add_expense', async (conv, { expense }) => {
  
  conv.contexts.set(Contexts.ADD_EXPENSE, 5);

  const allCategories = await getCategories();
  const expenseCategory = expense['expense_category'];
  const expenseModel = expenseFromUseInput(expense);

  const categoryExists = allCategories.indexOf(expenseCategory) !== -1;

  if(!categoryExists){
    conv.data['inexistentCategory'] = expenseCategory;
    conv.data['expenseToCreate'] = expenseModel;
    conv.ask(TRANSLATIONS.CREATE_CATEGORY_AND_SAVE_EXPENSE_MESSAGE);
    return conv;  
  }

  await createExpense(expenseModel);

  conv.add(TRANSLATIONS.EXPENSE_ADDED_MESSAGE);
  return conv;
  
});

app.intent('create_category_on_add_expense_yes', async (conv) => {
  
  await createCategory(conv.data['inexistentCategory']);
  await createExpense(conv.data['expenseToCreate']);

  conv.add(TRANSLATIONS.CATEGORY_ADDED_MESSAGE);
  return conv;

});

app.intent('create_category_on_add_expense_no', async (conv) => {
  
  const expenseCategory = conv.data['inexistentCategory'];
  const expenseToCreate = conv.data['expenseToCreate'];
  expenseToCreate.category = OTHER_CATEGORY;

  await createCategory(expenseCategory);
  await createExpense(expenseToCreate);

  conv.add(TRANSLATIONS.CATEGORY_ADDED_MESSAGE);
  return conv;

});


app.intent('list_expense_categories', async (conv) => {
  
  const categories = await getCategories();
  
  if(categories.length === 0){
    conv.add(TRANSLATIONS.EMPTY_CATEGORIES_MESSAGE);
    return conv;
  }

  conv.add(`${TRANSLATIONS.CATEGORIES_LIST_MESSAGE} ${categories.join(', ')}`);
  return conv;

});


function getCategories(){

  const categoriesRef = db.collection('expense_categories');

  return categoriesRef.get().then((snapshot) => {
    
    let results = [];
    
    if(snapshot.docs.length === 0){
      return results;
    }

    snapshot.forEach((doc) => {
      results.push(doc.data());
    });

    results = results.map(r => r.name);

    return results;
  });

}

function createCategory(categoryName){

  return db.collection('expense_categories').add({ name: categoryName});

}

function createExpense(expenseModel){

  return db.collection('expenses').add(expenseModel);

}

function expenseFromUseInput(expenseEntity){
  return {
    amount: expenseEntity['unit-currency']['amount'],
    currency: expenseEntity['unit-currency']['currency'],
    category: expenseEntity['expense_category'] || OTHER_CATEGORY
  }
}

// HTTP Cloud Function for Firebase handler
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);