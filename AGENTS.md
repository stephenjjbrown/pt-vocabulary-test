
MVC-like Flux-like merged convention,
Basically Flux-like singular data flow, but Dispatcher is like AppController, Actions are methods on the controller which mutate not Stores but Models, And Views are Views, but here Views are LitElement so I call them Elements.
Elements should never contain Controllers or Models.
Elements should only call Controller methods.
Controllers should never contain state.
Controllers should only manipulate models.
There will often be one controller for each model.
Models should be bound to Elements (Views)
Models should only contain state and should not contain methods except readonly getters.
Elements should only read from Models and write via Controller Methods.
