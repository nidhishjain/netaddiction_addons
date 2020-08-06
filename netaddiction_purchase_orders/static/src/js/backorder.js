odoo.define('netaddiction_purchase_orders.backorder', function (require) {
"use strict";
    var core = require('web.core');
    var framework = require('web.framework');
    var Model = require('web.DataModel');
    var session = require('web.session');
    var web_client = require('web.web_client');
    var Widget = require('web.Widget');
    var Dialog = require('web.Dialog');
    var Notification = require('web.notification');
    var Class = require('web.Class');
    var Pager = require('web.Pager');
    var ActionManager = require('web.ActionManager');

    var _t = core._t;
    var QWeb = core.qweb;
    var common = require('web.form_common');

    var Backorder = Widget.extend({
        init: function(parent){
            var self = this;
            self._super(parent);
            self.company_id = parseInt(session.company_id);
            self.context = session.user_context;
            self.picking_type = 1;
            self.incoming_datas = {};
            self.products = {};
            self.cancelled = {};
        },
        events: {
            'click .supplier_row': 'Open_Backorder',
            'click .open_product': 'OpenProduct',
            'click .open_sale': 'OpenSale',
            'click .open_order': 'OpenOrder',
            'click .open_customer': 'OpenCustomer',
            'click .cancel_backorder': 'OpenCancel',
            'click .save_cancel': 'delete_backorder',
            'click #cancelled': 'GetCancelled',
            'change #search' : 'Search',
            'click .oe-selection-focus': 'DefinitiveSearch'
        },
        start: function(){
            var self = this;
            self.$el.html(QWeb.render("backorder_top", {widget: self}));
            self.get_incoming_suppliers();
            self.get_incoming_qty_suppliers();
        },
        get_incoming_suppliers: function(){
            var self = this;
            new Model('stock.picking').query([]).filter([['picking_type_id','=',self.picking_type],['state','not in',['done', 'cancel']]]).order_by('partner_id').group_by('partner_id').then(function(results){
                var suppliers = [];
                $.each(results,function(index,value){
                    suppliers.push({'supplier':value.attributes.value[1], 'ships': value.attributes.length, 'supplier_id':value.attributes.value[0]});
                });
                self.$el.find('#table').html(QWeb.render("supplier_table", {suppliers: suppliers}));

                self.set_height();
            });
        },
        set_height: function(){
            var self = this;
            var h = self.$el.find('#backorder_top_block').outerHeight();
            var theadH = self.$el.find('#table thead').outerHeight();
            var topH = $('#oe_main_menu_navbar').outerHeight();
            self.$el.find('#backorder_top_block').css('top',topH);
            self.$el.find('#table thead').css('width','100%').css('margin-top',h+topH);
            self.$el.find('#table').css('margin-top',h);

            var row = self.$el.find('#table tbody tr').first();
            $(row).find('td').each(function(i,v){
                var id = $(v).attr('data-id');
                var width = $(v).outerWidth();
                $('#'+id).outerWidth(width);
            });

            var w = $('.oe_client_action').outerWidth();
            self.$el.find('#backorder_top_block').outerWidth(w);
        },
        get_incoming_qty_suppliers: function(e){
            var self = this;
            new Model('stock.move').call('get_incoming_number_products_values').then(function(results){
                var tot = 0;
                self.incoming_datas = results;
                $.each(results, function(index,value){
                    self.$el.find('#products_'+index).text(value.qty);
                    self.$el.find('#values_'+index).html('<b>'+value.value.toLocaleString()+'</b> &euro;');
                    tot = tot + value.value;
                });
                $('#backorder_value').html('<b>'+tot.toLocaleString()+'</b> &euro;');
            });
        },
        Open_Backorder: function(e){
            var self = this;
            var supplier = parseInt($(e.currentTarget).attr('data-id'));
            var sup_name = '';
            if(supplier in self.incoming_datas){
                var sup_name = self.incoming_datas[supplier]['name'];
            }
            
            var options ={
                title: "Prodotti Backorder", 
                subtitle: ' ' + sup_name,
                size: 'large',
                dialogClass: '',
                buttons: [{text: _t("Chiudi"), close: true, classes:"btn-primary close_dialog"}]
            }
                
            var dial = new Dialog(self,options);
            dial.open();
            self.get_products_supplier(supplier, dial);
        },
        get_products_supplier: function(supplier, dial){
            var self = this;
            if(supplier in self.products){
                dial.$el.html(QWeb.render("products_table", {products: self.products[supplier], supplier:supplier}));
            }else{
                new Model('stock.move').call('get_incoming_products_supplier',[supplier, self.context]).then(function(results){
                    if(results != 'Errore'){
                        self.products[supplier] = results;
                        dial.$el.html(QWeb.render("products_table", {products: results, supplier: supplier}));
                        self.setElement('body');
                    }
                });
            }
            
        },
        OpenProduct: function(e){
            e.preventDefault();
            var res_id = parseInt($(e.currentTarget).attr('data-id'));
            var pop = new common.FormViewDialog(this, {
                res_model: 'product.product',
                res_id:res_id,
                context: {},
                title: _t("Apri: Prodotto"),
                readonly:true
            }).open();
        },
        OpenOrder: function(e){
            e.preventDefault();
            var res_id = parseInt($(e.currentTarget).attr('data-id'));
            var pop = new common.FormViewDialog(this, {
                res_model: 'sale.order',
                res_id:res_id,
                context: {},
                title: _t("Apri: Ordine"),
                readonly:true
            }).open();
        },
        OpenCustomer: function(e){
            e.preventDefault();
            var res_id = parseInt($(e.currentTarget).attr('data-id'));
            var pop = new common.FormViewDialog(this, {
                res_model: 'res.partner',
                res_id:res_id,
                context: {},
                title: _t("Apri: Cliente"),
                readonly:true
            }).open();
        },
        OpenSale: function(e){
            var self = this;
            e.preventDefault();
            var res_id = parseInt($(e.currentTarget).attr('data-id'));
            var fields = ['order_id','order_partner_id','price_unit','state','price_total','product_uom_qty', 'product_id'];
            var filter = [['product_id.id','=',res_id],['state','not in',['done','cancel','draft']]];
            var states = {
                'sale': 'In Lavorazione',
                'sent': 'Preventivo Inviato',
                'partial_done': 'Parzialmente Completato',
                'problem': 'Problema',
                'pending': 'Pending'
            }
            new Model('sale.order.line').query(fields).filter(filter).all().then(function(results){
                if(results.length >0){
                    $.each(results,function(index,value){
                        value.price_total = value.price_total.toLocaleString();
                        value.price_unit = value.price_unit.toLocaleString();
                        value.state = states[value.state];
                    });
                    var options ={
                        title: "Vendite in processing", 
                        subtitle: ' ' + results[0].product_id[1],
                        size: 'large',
                        dialogClass: '',
                        buttons: [{text: _t("Chiudi"), close: true, classes:"btn-primary close_dialog"}]
                    }
                        
                    var dial = new Dialog(self,options);
                    dial.open();
                    dial.$el.html(QWeb.render("order_line_table", {lines: results}));
                    self.setElement('body');
                }else{
                     $('.o_notification_manager').css('z-index',999999);
                    return self.do_warn('Non ci sono vendite in lavorazione per questo prodotto');
                }
            });
        },
        OpenCancel: function(e){
            var self = this;
            e.preventDefault();
            var pid = parseInt($(e.currentTarget).attr('data-id'));
            var supplier = parseInt($(e.currentTarget).attr('data-supplier'));
            var datas = self.products[supplier][pid];
            var qty = self.products[supplier][pid]['qty'];
            var options ={
                title: "Quantità da cancellare", 
                subtitle: ' '+ datas.product_name,
                size: 'medium',
                dialogClass: '',
                buttons: [{text: _t("Chiudi"), close: true, classes:"btn-primary close_dialog"},{text: _t("Salva"), classes:"btn-danger save_cancel"}]
            }
            var dial = new Dialog(self,options);
            dial.open();
            dial.$el.html(QWeb.render("qty_form", {pid: pid, supplier: supplier, qty: qty}));
            self.setElement('body');
        },
        delete_backorder: function(e){
            var self = this;
            var pid = parseInt($('#qty_to_delete').attr('data-id'));
            var supplier = parseInt($('#qty_to_delete').attr('data-supplier'));
            var qty = parseInt($('#qty_to_delete').val());
            var max = self.products[supplier][pid]['qty']; 
            if(qty > max){
                $('.o_notification_manager').css('z-index',999999);
                return self.do_warn('Non puoi superare la quantità massima ordinata di ' + max);
            }
            if(qty <= 0){
                $('.o_notification_manager').css('z-index',999999);
                return self.do_warn('Non puoi cancellare una quantità <= 0');
            }
            if(qty > 0 && qty <=max){
                $('.o_notification_manager').css('z-index',999999);
                var datas = self.products[supplier][pid];
                new Model('stock.move').call('app_cancel_backorder',[datas, qty, self.context]).then(function(results){
                    var old = $('#qta_'+supplier+'_'+pid).text();
                    if(old){
                        old = parseInt(old);
                        var new_value = old - qty;
                        if(new_value>0){
                            $('#qta_'+supplier+'_'+pid).text(new_value);
                        }else{
                            $('#qta_'+supplier+'_'+pid).closest('tr').remove();
                        }
                    }
                    self.products[supplier][pid]['qty'] = new_value;
                    self.do_notify('Quantità backorder aggiornata');
                    self.__parentedChildren[1].destroy();
                    

                    new Model('stock.move').call('log_change_backorder',[supplier, self.products[supplier][pid]['product_name'], self.products[supplier][pid]['supplier_code'], pid, old, new_value, self.context.uid, self.company_id]);
                });
            }
        },
        GetCancelled: function(e){
            var self = this
            var date = false;
            new Model('stock.move').call('get_backorder_cancelled', [date, self.company_id]).then(function(results){
                var options ={
                    title: "Riepilogo Cancellati", 
                    subtitle: ' ',
                    size: 'large',
                    dialogClass: '',
                    buttons: [{text: _t("Chiudi"), close: true, classes:"btn-primary close_dialog"}]
                }
                    
                var dial = new Dialog(self,options);
                dial.open();
                dial.$el.html(QWeb.render("cancelled_table", {results: results}));
                self.setElement('body');
            });
        },
        Search: function(r){
            $('.supplier_row').each(function(i,v){
                $(this).css('background-color', '');
            });
            var self = this;
            var name = self.$el.find('#search').val();
            if(name != ''){
                new Model('product.product').call('name_search', [name, [], 'ilike', 15]).then(function(results){
                    var html = '';
                    $.each(results, function(index, value){
                        html = html + '<li data-id="'+value[0]+'">'+value[1]+'</li>';
                    });
                    self.$el.find('.oe-autocomplete ul').html(html);
                    self.$el.find('.oe-autocomplete').show();

                    $('.oe-autocomplete li').hover(function(){
                        $(this).css('cursor', 'pointer');
                        $(this).addClass('oe-selection-focus');
                    },function(){
                        $(this).removeClass('oe-selection-focus')
                    })
                });
            }
        },
        DefinitiveSearch: function(e){
            var self = this;
            var pid = $(e.currentTarget).attr('data-id');
            var name = $(e.currentTarget).text();
            $(e.currentTarget).closest('.oe-autocomplete ul').html('');
            $('.oe-autocomplete').hide();
            self.$el.find('#search').val(name);

            var filter = [['picking_type_id', '=', 1], ['state', 'not in', ['done', 'cancel']], ['product_id', '=', parseInt(pid)]];
            var suppliers = [];
            new Model('stock.move').query(['picking_partner_id']).filter(filter).all().then(function(results){
                $.each(results, function(index,value){
                    $('.supplier_row').each(function(i,v){
                        if(parseInt($(v).attr('data-id')) == parseInt(value.picking_partner_id[0]) ){
                            $(this).css('background', 'red');
                        }
                    });
                })
            });
        }
    });


    core.action_registry.add("netaddiction_purchase_orders.backorder", Backorder);
});

    