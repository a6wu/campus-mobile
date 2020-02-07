import 'package:campus_mobile_experimental/core/data_providers/messages_data_provider.dart';
import 'package:campus_mobile_experimental/core/models/message_model.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:campus_mobile_experimental/ui/views/notifications/notifications_detail_view.dart';

class Notifications extends StatefulWidget {
  @override
  State<StatefulWidget> createState() => _NotificationsState();
}

class _NotificationsState extends State<Notifications>{
  MessagesDataProvider _messagesDataProvider;

  void _updateData(){
    if(!_messagesDataProvider.isLoading){
      print("called");
      _messagesDataProvider.fetchMessages();
    }
  }

  @override
  void didChangeDependencies(){
    super.didChangeDependencies();
    _messagesDataProvider = Provider.of<MessagesDataProvider>(context);
  }

  @override
  Widget build(BuildContext context) {
    List<MessageElement> data = _messagesDataProvider.messages;
    //print("right now");

    return Column(children: <Widget>[
      Expanded(
        flex: 1, 
        child: NotificationsDetailView(data,_updateData)
        )
      ],
    );
  }
}
