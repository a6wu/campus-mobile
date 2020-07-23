import 'package:campus_mobile_experimental/core/constants/app_constants.dart';
import 'package:campus_mobile_experimental/core/data_providers/cards_data_provider.dart';
import 'package:campus_mobile_experimental/ui/reusable_widgets/card_container.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';

const String cardId = 'StaffInfoCard';

class StaffInfoCard extends StatefulWidget {
  StaffInfoCard();
  @override
  _StaffInfoCardState createState() => _StaffInfoCardState();
}

class _StaffInfoCardState extends State<StaffInfoCard> {
  _StaffInfoCardState();

  final _controller = new PageController();
  String url = 'https://mobile.ucsd.edu/replatform/v1/qa/webview/staff_info.html';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
  }

  Widget build(BuildContext context) {
    return CardContainer(
      titleText: CardTitleConstants.titleMap[cardId],
      isLoading: false,
      reload: updateUrl,
      errorText: null,
      child: () => buildStaffCard(),
      active: Provider.of<CardsDataProvider>(context).cardStates[cardId],
      hide: () => Provider.of<CardsDataProvider>(context, listen: false)
          .toggleCard(cardId),
    );
  }

  Widget buildStaffCard() {

    return Column(
      children: <Widget>[
        Flexible(
            child: WebView(
                javascriptMode: JavascriptMode.unrestricted, initialUrl: url)),
      ],
    );
  }

  void updateUrl() {
    setState() {
      url = 'https://mobile.ucsd.edu/replatform/v1/qa/webview/staff_info.html';
    }
  }

}
